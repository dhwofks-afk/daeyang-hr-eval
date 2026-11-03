// 관리자 화면의 저장소 읽기·쓰기 공통 파일 (리포트·점수·보정·건의함이 함께 쓴다)
// 공개용 열쇠 + 관리자 로그인으로만 읽힌다. 안전은 저장소의 권한 규칙(002·005)이 지킨다.
// 역할 미리보기(가짜 데이터)면 isAdminSession()이 false → 화면은 가짜 데이터를 쓴다.
// 점수는 저장하지 않고 scoring.ts로 그때그때 계산한다. 결과 확정 때만 확정 결과 표에 저장한다.
import {
  computeResults,
  stageFieldScoresFromAnswers,
  type AdjustmentRecord,
  type AnswerCase,
  type AnswerQuestion,
  type AnswerRow,
  type EvaluatedRole,
  type MixRatio,
  type ScoreInput,
  type ScoreResult,
  type StageKey,
  type Weights,
} from "@/lib/scoring"
import { supabase } from "@/lib/supabase"

const NOT_CONNECTED = "저장소 설정(.env.local)이 없어 불러올 수 없습니다."
const NO_PERMISSION = "권한이 없습니다. 관리자로 로그인했는지 확인해 주세요."

function client() {
  if (!supabase) throw new Error(NOT_CONNECTED)
  return supabase
}

type ServerError = { code?: string; message: string }

// 저장소 오류 → 화면 문구. 권한 규칙에 막힌 오류(42501)만 쉬운 문구로 바꾸고, 나머지는 저장소 문구 그대로
function serverError(error: ServerError) {
  return new Error(error.code === "42501" ? NO_PERMISSION : error.message)
}

// 한 번에 1000줄까지만 오므로 나눠서 모두 읽는다
const PAGE = 1000
async function readAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: unknown; error: ServerError | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1)
    if (error) throw serverError(error)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE) return rows
  }
}

// 실제 관리자로 로그인했는지 (역할 미리보기면 false)
export async function isAdminSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  if (!data.session) return false
  const { data: isAdmin } = await supabase.rpc("is_admin")
  return isAdmin === true
}

// ---------- 회차 (평가 설정) ----------

export type AdminCycle = {
  id: number
  name: string
  status: "before" | "in_progress" | "done"
  startDate: string | null // 평가 시작일 (예: 2026-11-03). 미정이면 null
  deadline: string | null // 평가 마감일. 미정이면 null
  resultPublished: boolean
  publishedAt: string | null // 화면 시각 (예: 2026-11-04T14:00:05)
  weights: Weights
  mix: MixRatio
}

type CycleRow = {
  id: number
  name: string
  status: AdminCycle["status"]
  start_date: string | null
  deadline: string | null
  result_published: boolean
  published_at: string | null
  weight_member_self: number
  weight_member_leader: number
  weight_member_executive: number
  weight_leader_self: number
  weight_leader_executive: number
  mix_member_personal: number
  mix_member_kpi: number
  mix_leader_personal: number
  mix_leader_kpi: number
  mix_leader_upward: number
  mix_exec_upward: number
  mix_exec_kpi: number
  exec_upward_member: number
  exec_upward_leader: number
}

// 저장소 시각(UTC) → 이 컴퓨터 시각 글자 (예: 2026-11-04T14:00:05)
function localText(value: string | null) {
  if (!value) return null
  const time = new Date(value)
  const two = (n: number) => String(n).padStart(2, "0")
  return `${time.getFullYear()}-${two(time.getMonth() + 1)}-${two(time.getDate())}T${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())}`
}

const num = (value: unknown) => Number(value)

function toCycle(row: CycleRow): AdminCycle {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    startDate: row.start_date,
    deadline: row.deadline,
    resultPublished: row.result_published,
    publishedAt: localText(row.published_at),
    weights: {
      member: {
        self: num(row.weight_member_self),
        leader: num(row.weight_member_leader),
        executive: num(row.weight_member_executive),
      },
      leader: { self: num(row.weight_leader_self), executive: num(row.weight_leader_executive) },
    },
    mix: {
      member: { personal: num(row.mix_member_personal), kpi: num(row.mix_member_kpi) },
      leader: {
        personal: num(row.mix_leader_personal),
        kpi: num(row.mix_leader_kpi),
        upward: num(row.mix_leader_upward),
      },
      executive: { upward: num(row.mix_exec_upward), kpi: num(row.mix_exec_kpi) },
      execUpward: { member: num(row.exec_upward_member), leader: num(row.exec_upward_leader) },
    },
  }
}

// 지금 회차: 평가 중인 회차, 없으면 번호가 가장 큰 회차. 회차가 없으면 null
export async function loadCurrentCycle(): Promise<AdminCycle | null> {
  const { data, error } = await client().from("cycles").select("*").order("id", { ascending: false })
  if (error) throw serverError(error)
  const rows = (data ?? []) as CycleRow[]
  const row = rows.find((item) => item.status === "in_progress") ?? rows[0]
  return row ? toCycle(row) : null
}

// ---------- 직원·부서 ----------

export type AdminPerson = {
  id: number // 내부 번호 (저장할 때만 쓴다)
  employeeNo: string
  name: string
  department: string
  position: string
  role: EvaluatedRole
  excluded: boolean
  status: "active" | "retired"
}

type EmployeeRow = Omit<AdminPerson, "employeeNo" | "department"> & {
  employee_no: string
  departments: { name: string } | null
}

async function loadPeople(): Promise<AdminPerson[]> {
  const rows = await readAll<EmployeeRow>((from, to) =>
    client()
      .from("employees")
      .select("id, employee_no, name, position, role, excluded, status, departments(name)")
      .order("id")
      .range(from, to),
  )
  return rows.map(({ employee_no, departments, ...rest }) => ({
    ...rest,
    employeeNo: employee_no,
    department: departments?.name ?? "",
  }))
}

export type AdminDepartment = { id: number; name: string; kpi: number | null }

async function loadDepartments(): Promise<AdminDepartment[]> {
  const { data, error } = await client().from("departments").select("id, name, kpi").order("id")
  if (error) throw serverError(error)
  return ((data ?? []) as AdminDepartment[]).map((row) => ({
    ...row,
    kpi: row.kpi === null ? null : num(row.kpi),
  }))
}

// ---------- 점수 계산 자료 (제출된 평가 건·답·문항·보정 기록) ----------

// 받은 평가의 종합 의견 (제출된 건만). 평가자는 넣지 않는다
export type CaseOpinion = { targetNo: string; stage: StageKey; opinion: string }

export type ScoreData = {
  cycle: AdminCycle
  people: AdminPerson[]
  departments: AdminDepartment[]
  input: ScoreInput // scoring.ts에 그대로 넘기는 값
  // 제출된 평가 건·문항·답 (본인이 한 상향 평가 점수: scoring.ts givenUpwardScores)
  answerData: { cases: AnswerCase[]; questions: AnswerQuestion[]; answers: AnswerRow[] }
  opinions: CaseOpinion[]
}

async function loadAdjustments(cycleId: number, noById: Map<number, string>): Promise<AdjustmentRecord[]> {
  const rows = await readAll<{
    employee_id: number
    before_score: number
    after_score: number | null
    reason: string | null
    adjusted_by: string
    adjusted_at: string
  }>((from, to) =>
    client()
      .from("adjustments")
      .select("employee_id, before_score, after_score, reason, adjusted_by, adjusted_at")
      .eq("cycle_id", cycleId)
      .order("adjusted_at")
      .order("id")
      .range(from, to),
  )
  return rows.map((row) => ({
    round: cycleId,
    employeeNo: noById.get(row.employee_id) ?? "",
    before: num(row.before_score),
    after: row.after_score === null ? null : num(row.after_score),
    reason: row.reason ?? "",
    adjustedBy: row.adjusted_by,
    adjustedAt: localText(row.adjusted_at) ?? "",
  }))
}

// 회차의 점수 계산 자료를 한 번에 읽는다. 계산은 scoreResultsOf(data)
export async function loadScoreData(cycle: AdminCycle): Promise<ScoreData> {
  const [people, departments] = await Promise.all([loadPeople(), loadDepartments()])
  const personById = new Map(people.map((person) => [person.id, person]))
  const noById = new Map(people.map((person) => [person.id, person.employeeNo]))

  const caseRows = await readAll<{ id: number; target_id: number; evaluator_id: number; stage: StageKey; opinion: string | null }>(
    (from, to) =>
      client()
        .from("cases")
        .select("id, target_id, evaluator_id, stage, opinion")
        .eq("cycle_id", cycle.id)
        .eq("status", "submitted")
        .order("id")
        .range(from, to),
  )
  const cases: AnswerCase[] = caseRows.flatMap((row) => {
    const target = personById.get(row.target_id)
    const evaluator = personById.get(row.evaluator_id)
    if (!target || !evaluator) return []
    return [
      {
        id: row.id,
        targetNo: target.employeeNo,
        targetRole: target.role,
        evaluatorRole: evaluator.role,
        evaluatorNo: evaluator.employeeNo,
        stage: row.stage,
      },
    ]
  })

  const [questionRows, answerRows, adjustments] = await Promise.all([
    readAll<{ id: number; field: string; factor: string; type: "choice" | "essay"; factor_points: number }>((from, to) =>
      client()
        .from("questions")
        .select("id, field, factor, type, factor_points")
        .eq("cycle_id", cycle.id)
        .order("id")
        .range(from, to),
    ),
    // 이 회차 문항의 답만 (제출 안 된 건의 답은 아래에서 뺀다)
    readAll<{ case_id: number; question_id: number; score: number | null }>((from, to) =>
      client()
        .from("answers")
        .select("case_id, question_id, score, questions!inner(cycle_id)")
        .eq("questions.cycle_id", cycle.id)
        .order("case_id")
        .order("question_id")
        .range(from, to),
    ),
    loadAdjustments(cycle.id, noById),
  ])

  const submitted = new Set(cases.map((item) => item.id))
  const answerData = {
    cases,
    questions: questionRows.map((row) => ({
      id: row.id,
      field: row.field,
      factor: row.factor,
      type: row.type,
      points: num(row.factor_points),
    })),
    answers: answerRows
      .filter((row) => submitted.has(row.case_id))
      .map((row) => ({
        caseId: row.case_id,
        questionId: row.question_id,
        score: row.score === null ? null : num(row.score),
      })),
  }
  const stageFieldScores = stageFieldScoresFromAnswers(answerData)
  const opinions = caseRows.flatMap((row) => {
    const target = personById.get(row.target_id)
    const opinion = row.opinion?.trim()
    return target && opinion ? [{ targetNo: target.employeeNo, stage: row.stage, opinion }] : []
  })

  return {
    cycle,
    people,
    departments,
    input: {
      people,
      stageFieldScores,
      // KPI가 아직 없으면 0점으로 섞는다 (scoring.ts와 같은 규칙)
      departments: departments.map((department) => ({ name: department.name, kpi: department.kpi ?? 0 })),
      weights: cycle.weights,
      mix: cycle.mix,
      adjustments,
    },
    answerData,
    opinions,
  }
}

export const scoreResultsOf = (data: ScoreData) => computeResults(data.input)

// ---------- 결과 확정 (리포트) ----------

// 확정 결과 한 줄 (사원번호로 연결)
export type FinalResult = {
  employeeNo: string
  department: string
  stages: Record<StageKey, number | null>
  weighted: number
  kpiApplied: number
  final: number
}

export async function loadFinalResults(cycleId: number, people: AdminPerson[]): Promise<FinalResult[]> {
  const noById = new Map(people.map((person) => [person.id, person.employeeNo]))
  const rows = await readAll<{
    employee_id: number
    department_name: string
    score_self: number | null
    score_leader: number | null
    score_executive: number | null
    score_upward: number | null
    score_exec_upward: number | null
    weighted: number
    kpi_applied: number
    final: number
  }>((from, to) =>
    client()
      .from("final_results")
      .select(
        "employee_id, department_name, score_self, score_leader, score_executive, score_upward, score_exec_upward, weighted, kpi_applied, final",
      )
      .eq("cycle_id", cycleId)
      .order("employee_id")
      .range(from, to),
  )
  const score = (value: number | null) => (value === null ? null : num(value))
  return rows.flatMap((row) => {
    const employeeNo = noById.get(row.employee_id)
    if (!employeeNo) return []
    return [
      {
        employeeNo,
        department: row.department_name,
        stages: {
          self: score(row.score_self),
          leader: score(row.score_leader),
          executive: score(row.score_executive),
          upward: score(row.score_upward),
          exec_upward: score(row.score_exec_upward),
        },
        weighted: num(row.weighted),
        kpiApplied: num(row.kpi_applied),
        final: num(row.final),
      },
    ]
  })
}

// 결과 확정: 계산 결과를 확정 결과 표에 저장하고 잠근다 (서버 함수 publish_results, 011)
export async function publishResults(cycleId: number, results: ScoreResult[], people: AdminPerson[]) {
  const idByNo = new Map(people.map((person) => [person.employeeNo, person.id]))
  const one = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10)
  const rows = results.flatMap((result) => {
    const id = idByNo.get(result.employeeNo)
    if (id === undefined) return []
    return [
      {
        employee_id: id,
        department_name: result.department,
        score_self: one(result.stages.self),
        score_leader: one(result.stages.leader),
        score_executive: one(result.stages.executive),
        score_upward: one(result.stages.upward),
        score_exec_upward: one(result.stages.exec_upward),
        weighted: one(result.weighted),
        kpi_applied: result.kpiApplied,
        final: result.final,
      },
    ]
  })
  const { error } = await client().rpc("publish_results", { p_cycle_id: cycleId, p_results: rows })
  if (error) throw serverError(error)
}

// 확정 취소: 잠금만 푼다. 확정 결과는 남는다 (서버 함수 unpublish_results, 006)
export async function unpublishResults(cycleId: number) {
  const { error } = await client().rpc("unpublish_results", { p_cycle_id: cycleId })
  if (error) throw serverError(error)
}

// ---------- 건의함 ----------

// 건의 내용만 (작성자·시각 칸은 표에 없다)
export async function loadSuggestions(cycleId: number): Promise<string[]> {
  const rows = await readAll<{ content: string }>((from, to) =>
    client().from("suggestions").select("content").eq("cycle_id", cycleId).order("id").range(from, to),
  )
  return rows.map((row) => row.content)
}

// ---------- 평가 설계: 문항·평가 대상 수 (읽기) ----------

// 문항 한 줄 (평가 설계 화면이 쓰는 모양: src/data/evaluations.ts의 Question과 같은 칸)
export type AdminQuestion = {
  id: number
  questionSet: "office_member" | "office_leader" | "production_member" | "production_leader" | "upward"
  field: string // 구분(분야)
  factor: string // 평가 내용(평정요소)
  factorPoints: number // 평가 내용 배점
  content: string // 문구
  type: "choice" | "essay"
  sortOrder: number
}

export async function loadQuestions(cycleId: number): Promise<AdminQuestion[]> {
  const rows = await readAll<{
    id: number
    question_set: AdminQuestion["questionSet"]
    field: string
    factor: string
    factor_points: number
    content: string
    type: AdminQuestion["type"]
    sort_order: number
  }>((from, to) =>
    client()
      .from("questions")
      .select("id, question_set, field, factor, factor_points, content, type, sort_order")
      .eq("cycle_id", cycleId)
      .order("question_set")
      .order("sort_order")
      .order("id")
      .range(from, to),
  )
  return rows.map((row) => ({
    id: row.id,
    questionSet: row.question_set,
    field: row.field,
    factor: row.factor,
    factorPoints: num(row.factor_points),
    content: row.content,
    type: row.type,
    sortOrder: row.sort_order,
  }))
}

// 평가 대상 수: 재직 직원(임원 포함) 중 평가 제외가 아닌 사람 (11/4 결정)
export async function loadTargetSummary() {
  const rows = await readAll<{ status: "active" | "retired"; excluded: boolean }>((from, to) =>
    client().from("employees").select("status, excluded").order("id").range(from, to),
  )
  const active = rows.filter((row) => row.status === "active")
  const excluded = active.filter((row) => row.excluded).length
  return { total: active.length, excluded, target: active.length - excluded }
}

// ---------- 평가 설계 저장 (실제 데이터가 바뀐다) ----------

// 평가 전 회차의 이름·시작일·마감일 (평가 설정 cycles)
export async function saveCycleSettings(
  cycleId: number,
  values: { name: string; startDate: string | null; deadline: string | null },
) {
  const { data, error } = await client()
    .from("cycles")
    .update({ name: values.name, start_date: values.startDate, deadline: values.deadline })
    .eq("id", cycleId)
    .select("id")
  if (error) throw serverError(error)
  requireRows(data, "평가 기본 설정")
}

// 평가 시작: 평가 전 → 평가 중 + 날짜 저장. 평가 건이 없으면 규칙대로 만든다 (서버 함수 start_cycle, 006)
export async function startCycle(cycleId: number, startDate: string, deadline: string) {
  const { error } = await client().rpc("start_cycle", {
    p_cycle_id: cycleId,
    p_start: startDate,
    p_deadline: deadline,
  })
  if (error) throw serverError(error)
}

// 마감일 수정: 평가 중일 때만 (서버 함수 update_deadline, 006)
export async function updateDeadline(cycleId: number, deadline: string) {
  const { error } = await client().rpc("update_deadline", { p_cycle_id: cycleId, p_deadline: deadline })
  if (error) throw serverError(error)
}

// 문항 세트 하나를 화면 목록 그대로 저장한다 (평가 전에만. 시작 후에는 저장소가 거부한다: 006 잠금 장치 2)
// 고친 문항 수정 → 새 문항 추가 → 지운 문항 삭제 순서로 쓴다. 한 번에 묶이지 않아 중간에 실패하면 일부만 저장될 수 있다.
// 답이 달린 문항은 지울 수 없다 (저장소가 거부). 새 문항(번호가 저장소에 없는 문항)은 저장소가 번호를 정한다.
export async function saveQuestionSet(
  cycleId: number,
  questionSet: AdminQuestion["questionSet"],
  questions: AdminQuestion[],
  savedIds: number[],
) {
  const db = client()
  const saved = new Set(savedIds)
  const values = (question: AdminQuestion) => ({
    field: question.field,
    factor: question.factor,
    factor_points: question.factorPoints,
    content: question.content,
    type: question.type,
    sort_order: question.sortOrder,
  })

  for (const question of questions.filter((item) => saved.has(item.id))) {
    const { data, error } = await db
      .from("questions")
      .update(values(question))
      .eq("id", question.id)
      .eq("cycle_id", cycleId)
      .select("id")
    if (error) throw serverError(error)
    requireRows(data, "문항")
  }

  const added = questions.filter((item) => !saved.has(item.id))
  if (added.length) {
    const { error } = await db
      .from("questions")
      .insert(added.map((question) => ({ cycle_id: cycleId, question_set: questionSet, ...values(question) })))
    if (error) throw serverError(error)
  }

  const kept = new Set(questions.map((item) => item.id))
  const removed = savedIds.filter((id) => !kept.has(id))
  if (removed.length) {
    const { error } = await db.from("questions").delete().in("id", removed).eq("cycle_id", cycleId)
    if (error) {
      // 23503 = 다른 표(답)가 이 문항을 가리킴
      throw error.code === "23503"
        ? new Error("답이 달린 문항은 지울 수 없습니다.")
        : serverError(error)
    }
  }
}

// ---------- 점수·보정 저장 (결과 확정 후에는 저장소가 거부한다: 003·010·011 잠금) ----------

// 바꾼 줄이 없으면 권한 규칙에 막힌 것이다 (규칙은 오류 없이 0줄로 끝난다)
function requireRows(data: unknown[] | null, what: string) {
  if (!data?.length) throw new Error(`${what}이(가) 저장되지 않았습니다. 관리자로 다시 로그인해 주세요.`)
}

// 가중치·최종 점수 비율 (평가 설정 cycles)
export async function saveCycleRatios(cycleId: number, weights: Weights, mix: MixRatio) {
  const { data, error } = await client()
    .from("cycles")
    .update({
      weight_member_self: weights.member.self,
      weight_member_leader: weights.member.leader,
      weight_member_executive: weights.member.executive,
      weight_leader_self: weights.leader.self,
      weight_leader_executive: weights.leader.executive,
      mix_member_personal: mix.member.personal,
      mix_member_kpi: mix.member.kpi,
      mix_leader_personal: mix.leader.personal,
      mix_leader_kpi: mix.leader.kpi,
      mix_leader_upward: mix.leader.upward,
      mix_exec_upward: mix.executive.upward,
      mix_exec_kpi: mix.executive.kpi,
      exec_upward_member: mix.execUpward.member,
      exec_upward_leader: mix.execUpward.leader,
    })
    .eq("id", cycleId)
    .select("id")
  if (error) throw serverError(error)
  requireRows(data, "비율")
}

// 부서 KPI (departments.kpi). 바뀐 부서만 넘긴다
export async function saveDepartmentKpi(changes: { id: number; kpi: number }[]) {
  for (const change of changes) {
    const { data, error } = await client()
      .from("departments")
      .update({ kpi: change.kpi })
      .eq("id", change.id)
      .select("id")
    if (error) throw serverError(error)
    requireRows(data, "KPI")
  }
}

// 보정 기록 새 줄 (여러 명 한 번에). after가 null이면 보정 취소 (005에서 빈 값 허용)
// 보정한 사람·시각은 서버가 채운다 (003 prepare_adjustment)
export async function insertAdjustments(
  cycleId: number,
  rows: { employeeId: number; before: number; after: number | null; reason: string }[],
) {
  const { error } = await client()
    .from("adjustments")
    .insert(
      rows.map((row) => ({
        cycle_id: cycleId,
        employee_id: row.employeeId,
        before_score: row.before,
        after_score: row.after,
        reason: row.reason || null,
      })),
    )
  if (error) throw serverError(error)
}
