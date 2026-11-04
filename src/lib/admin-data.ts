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
  // before 준비 중 / in_progress 평가 중 / done 완료(결과 확정) / cleared 결과 삭제됨 (016)
  status: "before" | "in_progress" | "done" | "cleared"
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

// 평가 상태 이름 (화면 표시)
export const cycleStatusNames: Record<AdminCycle["status"], string> = {
  before: "준비 중",
  in_progress: "평가 중",
  done: "완료",
  cleared: "결과 삭제됨",
}

// ---------- 평가 고르기 (관리자 화면 위의 선택 상자, 016) ----------
// 관리자가 고른 평가 번호. 고르지 않았으면 null → 평가 중인 평가, 없으면 번호가 가장 큰 평가
// 이 컴퓨터에만 기억한다 (새로고침해도 유지). 저장 공간을 못 쓰면 화면을 여는 동안만 기억한다
const CHOSEN_KEY = "admin-chosen-cycle"
let chosenCycleId: number | null = (() => {
  try {
    const saved = Number(localStorage.getItem(CHOSEN_KEY))
    return Number.isInteger(saved) && saved > 0 ? saved : null
  } catch {
    return null
  }
})()
const chosenListeners = new Set<() => void>()

export const getChosenCycleId = () => chosenCycleId

export function chooseCycle(id: number | null) {
  chosenCycleId = id
  try {
    if (id === null) localStorage.removeItem(CHOSEN_KEY)
    else localStorage.setItem(CHOSEN_KEY, String(id))
  } catch {
    // 저장 공간을 못 쓰면 화면을 여는 동안만 기억한다
  }
  for (const listener of chosenListeners) listener()
}

export function subscribeChosenCycle(listener: () => void) {
  chosenListeners.add(listener)
  return () => {
    chosenListeners.delete(listener)
  }
}

async function loadCycleRows() {
  const { data, error } = await client().from("cycles").select("*").order("id", { ascending: false })
  if (error) throw serverError(error)
  return (data ?? []) as CycleRow[]
}

// 평가 전체 (번호가 큰 것부터)
export async function loadCycles(): Promise<AdminCycle[]> {
  return (await loadCycleRows()).map(toCycle)
}

// 기본 평가: 평가 중인 평가, 없으면 번호가 가장 큰 평가
const defaultRow = (rows: CycleRow[]) => rows.find((item) => item.status === "in_progress") ?? rows[0]

// 관리자 화면이 보는 평가: 고른 평가(지워졌으면 기본 평가). 평가가 없으면 null
export async function loadCurrentCycle(): Promise<AdminCycle | null> {
  const rows = await loadCycleRows()
  const row = rows.find((item) => item.id === chosenCycleId) ?? defaultRow(rows)
  return row ? toCycle(row) : null
}

// 지금 평가 중인 평가 (직원 화면·조직도 잠금). 없으면 null
export async function loadOpenCycle(): Promise<AdminCycle | null> {
  const row = (await loadCycleRows()).find((item) => item.status === "in_progress")
  return row ? toCycle(row) : null
}

// 평가 추가: 고른 평가의 비율·문항·부서 KPI를 복사하고 평가 관계는 규칙대로 새로 만든다 (016 new_cycle). 새 번호
export async function newCycle(name: string, sourceId: number): Promise<number> {
  const { data, error } = await client().rpc("new_cycle", { p_name: name, p_source: sourceId })
  if (error) throw serverError(error)
  return data as number
}

// 평가 카드 삭제: 준비 중만 (017 delete_cycle)
export async function deleteCycle(cycleId: number, confirmText: string) {
  const { error } = await client().rpc("delete_cycle", { p_cycle_id: cycleId, p_confirm: confirmText })
  if (error) throw serverError(error)
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
  headquarters: string | null // 본부 (임원만, 014). 비어 있으면 본부 없는 임원
}

type EmployeeRow = Omit<AdminPerson, "employeeNo" | "department" | "headquarters"> & {
  employee_no: string
  departments: { name: string } | null
  headquarters: { name: string } | null
}

// 직원 전체 (관리자만. 퇴사자 포함)
export async function loadPeople(): Promise<AdminPerson[]> {
  const rows = await readAll<EmployeeRow>((from, to) =>
    client()
      .from("employees")
      .select("id, employee_no, name, position, role, excluded, status, departments(name), headquarters(name)")
      .order("id")
      .range(from, to),
  )
  return rows.map(({ employee_no, departments, headquarters, ...rest }) => ({
    ...rest,
    employeeNo: employee_no,
    department: departments?.name ?? "",
    headquarters: headquarters?.name ?? null,
  }))
}

// headquarters: 부서의 본부 (014). 없으면 null
// kpi: 그 평가의 부서 KPI (016 cycle_kpis). 평가를 넘기지 않았거나 값이 없으면 null
export type AdminDepartment = { id: number; name: string; kpi: number | null; headquarters: string | null }

// 부서 (번호 순). cycleId를 넘기면 그 평가의 부서 KPI를 함께 읽는다
export async function loadDepartments(cycleId?: number): Promise<AdminDepartment[]> {
  const db = client()
  const { data, error } = await db.from("departments").select("id, name, headquarters(name)").order("id")
  if (error) throw serverError(error)
  const kpiById = new Map<number, number | null>()
  if (cycleId !== undefined) {
    const kpis = await db.from("cycle_kpis").select("department_id, kpi").eq("cycle_id", cycleId)
    if (kpis.error) throw serverError(kpis.error)
    for (const row of (kpis.data ?? []) as { department_id: number; kpi: number | null }[])
      kpiById.set(row.department_id, row.kpi === null ? null : num(row.kpi))
  }
  return ((data ?? []) as unknown as { id: number; name: string; headquarters: { name: string } | null }[]).map((row) => ({
    id: row.id,
    name: row.name,
    kpi: kpiById.get(row.id) ?? null,
    headquarters: row.headquarters?.name ?? null,
  }))
}

// 본부 → 소속 부서 이름 (임원 KPI = 그 본부 부서 KPI 평균)
export const headquarterDepartmentsOf = (departments: AdminDepartment[]) =>
  departments.reduce<Record<string, string[]>>((map, department) => {
    if (department.headquarters) (map[department.headquarters] ??= []).push(department.name)
    return map
  }, {})

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
  const [people, departments] = await Promise.all([loadPeople(), loadDepartments(cycle.id)])
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
      headquarterDepartments: headquarterDepartmentsOf(departments),
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
  questionSet: "member" | "leader" | "upward"
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

// ---------- 조직도: 직급 순서 (읽기) · 직원 저장 (실제 데이터가 바뀐다) ----------

// 직급 이름: 낮은 직급 → 높은 직급 (positions 표의 순서)
export async function loadPositions(): Promise<string[]> {
  const { data, error } = await client().from("positions").select("name, sort_order").order("sort_order")
  if (error) throw serverError(error)
  return ((data ?? []) as { name: string }[]).map((row) => row.name)
}

// 직원 한 명의 부서·직급·역할·평가 제외·재직 상태 (직원 삭제는 없다: 퇴사 처리만)
// 평가 중에는 재직 상태만 바꿀 수 있다 (화면에서 막고, 저장소는 009_org_lock.sql을 실행하면 막는다)
export async function saveEmployee(
  employeeId: number,
  change: {
    departmentId: number
    position: string
    role: EvaluatedRole
    excluded: boolean
    status: AdminPerson["status"]
  },
) {
  const { data, error } = await client()
    .from("employees")
    .update({
      department_id: change.departmentId,
      position: change.position,
      role: change.role,
      excluded: change.excluded,
      status: change.status,
    })
    .eq("id", employeeId)
    .select("id")
  if (error) throw serverError(error)
  requireRows(data, "직원 정보")
}

// 평가 중 퇴사 처리·되돌리기: 재직 상태만 바꾼다 (009 잠금이 있어도 허용되는 칸)
export async function saveEmployeeStatus(employeeId: number, status: AdminPerson["status"]) {
  const { data, error } = await client()
    .from("employees")
    .update({ status })
    .eq("id", employeeId)
    .select("id")
  if (error) throw serverError(error)
  requireRows(data, "재직 상태")
}

// ---------- 진행 관리: 평가 건 전체·반려 기록 (읽기) · 반려 (실제 데이터가 바뀐다) ----------

// 평가 건 한 줄 (모든 상태). 사람은 사원번호로 잇는다. 시각은 이 컴퓨터 시각 글자 (예: 2026-11-04T14:00:05)
export type ProgressCase = {
  id: number
  targetNo: string
  evaluatorNo: string
  stage: StageKey
  status: "not_started" | "in_progress" | "submitted" | "returned"
  submittedAt: string | null
}

export type ProgressReturnLog = {
  id: number
  caseId: number
  reason: string
  returnedBy: string
  returnedAt: string
}

// 회차의 평가 건 전체(작성 전·작성 중·제출·반려)와 반려 기록 (관리자만).
// loadScoreData는 "제출"된 건만 읽어 점수를 내고, 이 함수는 진행 상황을 보려고 모든 건을 읽는다.
export async function loadProgress(cycleId: number, people: AdminPerson[]) {
  const noById = new Map(people.map((person) => [person.id, person.employeeNo]))
  const [caseRows, logRows] = await Promise.all([
    readAll<{
      id: number
      target_id: number
      evaluator_id: number
      stage: StageKey
      status: ProgressCase["status"]
      submitted_at: string | null
    }>((from, to) =>
      client()
        .from("cases")
        .select("id, target_id, evaluator_id, stage, status, submitted_at")
        .eq("cycle_id", cycleId)
        .order("id")
        .range(from, to),
    ),
    readAll<{ id: number; case_id: number; reason: string; returned_by: string; returned_at: string }>(
      (from, to) =>
        client()
          .from("return_logs")
          .select("id, case_id, reason, returned_by, returned_at")
          .eq("cycle_id", cycleId)
          .order("id")
          .range(from, to),
    ),
  ])
  const cases: ProgressCase[] = caseRows.flatMap((row) => {
    const targetNo = noById.get(row.target_id)
    const evaluatorNo = noById.get(row.evaluator_id)
    if (!targetNo || !evaluatorNo) return []
    return [
      {
        id: row.id,
        targetNo,
        evaluatorNo,
        stage: row.stage,
        status: row.status,
        submittedAt: localText(row.submitted_at),
      },
    ]
  })
  const returnLogs: ProgressReturnLog[] = logRows.map((row) => ({
    id: row.id,
    caseId: row.case_id,
    reason: row.reason,
    returnedBy: row.returned_by,
    returnedAt: localText(row.returned_at) ?? "",
  }))
  return { cases, returnLogs }
}

// 반려: 평가 중·결과 확정 전·제출 상태일 때만. 사유 필수. 상태 "반려" + 반려 기록을 한 번에 (서버 함수 return_case, 006)
export async function returnCase(caseId: number, reason: string) {
  const { error } = await client().rpc("return_case", { p_case_id: caseId, p_reason: reason })
  if (error) throw serverError(error)
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

// 부서 KPI (그 평가의 cycle_kpis, 016). 바뀐 부서만 넘긴다. 결과 확정 후에는 저장소가 거부한다
export async function saveDepartmentKpi(cycleId: number, changes: { id: number; kpi: number }[]) {
  if (!changes.length) return
  const { data, error } = await client()
    .from("cycle_kpis")
    .upsert(changes.map((change) => ({ cycle_id: cycleId, department_id: change.id, kpi: change.kpi })))
    .select("department_id")
  if (error) throw serverError(error)
  requireRows(data, "KPI")
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
