// 평가 작성 저장 자리 (docs/06-평가작성.md). 목록 화면과 작성 화면이 함께 쓴다.
// - 실제 직원 로그인: 저장소(Supabase)에서 읽고 쓴다 (src/lib/employee-data.ts). 답 저장·제출은 평가 중일 때만 된다
// - 역할 미리보기: 가짜 데이터. 처음 값은 src/data/evaluations.ts에서 복사하고(evaluations.ts는 읽기만 한다),
//   화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다
// 점수는 계산하지 않는다 (scoring.ts가 함). 이 파일은 답을 저장하고 빠진 곳만 찾는다.
// 건의 · 만족도(docs/12-평가작성추가.md)도 여기서 받는다. 자기관찰은 11/2에 화면에서 뺐다 (서버 표는 그대로).
import { useEffect, useSyncExternalStore } from "react"
import {
  essayModeOf,
  evaluationAnswers,
  evaluationCases,
  questionsOf,
  returnReasons,
  satisfactionDone,
  type Answer,
  type EssayMode,
  type EvaluationCase,
  type Question,
  type QuestionSet,
} from "@/data/evaluations"
import { findPerson, type Person, type PersonRole } from "@/data/people"
import { evaluationSetting } from "@/data/scores"
import { loadCurrentCycle, loadPositions, loadQuestions } from "@/lib/admin-data"
import {
  loadMyAnswers,
  loadMyCaseDetails,
  loadMyCases,
  loadMyReturnReason,
  loadMySatisfactionDone,
  loadMyTargets,
  loadMyTargetSelfEssays,
  NeedsSqlError,
  saveMyAnswers,
  sendMySuggestion,
  submitMySatisfaction,
  updateMyCase,
} from "@/lib/employee-data"
import { fetchMyProfile } from "@/lib/supabase"

// 저장소에서 읽은 것 (가짜 데이터면 null)
export type ServerEvaluation = {
  me: { employeeNo: string; name: string } // 내 번호는 저장소 내부 번호 (사번은 쓰지 않는다)
  cycle: {
    id: number
    name: string
    status: "before" | "in_progress" | "done"
    startDate: string | null
    deadline: string | null
    resultPublished: boolean
  }
  targets: Record<number, Person> // 평가 건 번호 → 대상
  details: Record<number, { questionSet: QuestionSet; targetRole: PersonRole }> // 012 전이면 비어 있음
  previousDone: Record<number, boolean | null> // 평가 건 번호 → 대상의 전 단계 제출 여부
  questions: Question[]
  selfEssays: Record<number, { essay: string; score: number | null }> // 내 팀장·임원 평가 건 번호 → 대상의 자기평가 서술형
  returnReasons: Record<number, string>
  positionNames: string[] // 직급: 낮은 직급 → 높은 직급 (positions 표)
  needsSql: boolean // SQL 012가 아직 실행되지 않음 → 문항을 보여 줄 수 없다
}

export type EvaluationStore = {
  // checking: 실제 직원 로그인인지 확인 중 / loading: 저장소에서 읽는 중 / fake: 가짜 데이터 / server: 저장소
  source: "checking" | "loading" | "fake" | "server" | "error"
  error: string | null
  cases: EvaluationCase[]
  answers: Answer[]
  satisfactionDone: string[] // 만족도를 낸 사람 (내용은 없음)
  suggestionCount: number // 이번 화면에서 보낸 건의 수 (내용·작성자는 남기지 않음)
  server: ServerEvaluation | null
}

const fakeState = (): EvaluationStore => ({
  source: "fake",
  error: null,
  cases: [...evaluationCases],
  answers: [...evaluationAnswers],
  satisfactionDone: [...satisfactionDone],
  suggestionCount: 0,
  server: null,
})

let state: EvaluationStore = { ...fakeState(), source: "checking" }

const listeners = new Set<() => void>()

function update(next: EvaluationStore) {
  state = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// 화면에서 쓰는 값. 값이 바뀌면 이 값을 쓰는 페이지가 다시 그려진다.
export const useEvaluationStore = () =>
  useSyncExternalStore(subscribe, () => state)

// ---------- 저장소 연결 ----------

const messageOf = (caught: unknown) => (caught instanceof Error ? caught.message : String(caught))

// 상향·임원 상향 카드처럼 012 전이라 대상 역할을 모를 때: 단계로 짐작한다 (목록 묶음 표시용)
const roleFromStage = (stage: EvaluationCase["stage"]): PersonRole =>
  stage === "upward" ? "leader" : stage === "exec_upward" ? "executive" : "member"

async function reloadServer(name: string) {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("회차가 없습니다.")
  const [targets, myCases, satisfied, questionList, positionNames] = await Promise.all([
    loadMyTargets(cycle.id),
    loadMyCases(cycle.id),
    loadMySatisfactionDone(cycle.id),
    loadQuestions(cycle.id),
    loadPositions(),
  ])
  let needsSql = false
  let details: Awaited<ReturnType<typeof loadMyCaseDetails>> = []
  try {
    details = await loadMyCaseDetails(cycle.id)
  } catch (caught) {
    if (!(caught instanceof NeedsSqlError)) throw caught
    needsSql = true
  }
  const caseIds = targets.map((target) => target.caseId)
  const [answers, selfEssays] = await Promise.all([loadMyAnswers(caseIds), loadMyTargetSelfEssays(cycle.id)])
  const returned = targets.filter((target) => target.status === "returned")
  const reasons = await Promise.all(returned.map((target) => loadMyReturnReason(target.caseId)))

  // 내 번호: 자기평가 건의 대상(= 나). 임원은 자기평가가 없어 "me"
  const meNo = String(targets.find((target) => target.stage === "self")?.targetId ?? "me")
  const detailByCase = new Map(details.map((detail) => [detail.caseId, detail]))
  const caseById = new Map(myCases.map((item) => [item.id, item]))

  update({
    ...state,
    source: "server",
    error: null,
    cases: targets.map((target) => ({
      id: target.caseId,
      targetNo: String(target.targetId),
      evaluatorNo: meNo,
      stage: target.stage,
      status: target.status,
      opinion: caseById.get(target.caseId)?.opinion ?? "",
      submittedAt: caseById.get(target.caseId)?.submittedAt ?? null,
    })),
    answers: answers.map((answer) => ({ ...answer })),
    satisfactionDone: satisfied ? [meNo] : [],
    server: {
      me: { employeeNo: meNo, name },
      cycle: {
        id: cycle.id,
        name: cycle.name,
        status: cycle.status,
        startDate: cycle.startDate,
        deadline: cycle.deadline,
        resultPublished: cycle.resultPublished,
      },
      targets: Object.fromEntries(
        targets.map((target) => [
          target.caseId,
          {
            employeeNo: String(target.targetId),
            name: target.name,
            department: target.department,
            position: target.position,
            role: (detailByCase.get(target.caseId)?.targetRole as PersonRole | undefined) ?? roleFromStage(target.stage),
          },
        ]),
      ),
      details: Object.fromEntries(
        details.map((detail) => [
          detail.caseId,
          { questionSet: detail.questionSet as QuestionSet, targetRole: detail.targetRole as PersonRole },
        ]),
      ),
      previousDone: Object.fromEntries(targets.map((target) => [target.caseId, target.previousStageDone])),
      questions: questionList,
      selfEssays: Object.fromEntries(selfEssays.map((item) => [item.caseId, { essay: item.essay, score: item.score }])),
      returnReasons: Object.fromEntries(
        returned.flatMap((target, index) => (reasons[index] ? [[target.caseId, reasons[index]]] : [])),
      ),
      positionNames,
      needsSql,
    },
  })
}

// 평가 목록을 열 때마다 확인한다: 실제 직원 로그인이면 저장소에서 읽고, 아니면 가짜 데이터
// (가짜 데이터에서 고친 내용은 페이지를 옮겨도 남겨 둔다)
async function connect() {
  const profile = await fetchMyProfile()
  if (!profile || profile.role === "admin") {
    if (state.source !== "fake") update(fakeState())
    return
  }
  if (state.source !== "server") update({ ...state, source: "loading" })
  try {
    await reloadServer(profile.name)
  } catch (caught) {
    update({ ...state, source: "error", error: messageOf(caught) })
  }
}

// 평가 목록 페이지가 열릴 때 부른다 (작성 화면도 같은 페이지 안에서 열린다)
export function useEvaluationConnection() {
  useEffect(() => {
    void connect()
  }, [])
}

export const isEvaluationReady = (store: EvaluationStore) =>
  store.source === "fake" || store.source === "server"

// ---------- 읽기 ----------

export const findCase = (store: EvaluationStore, caseId: number) =>
  store.cases.find((item) => item.id === caseId)

// 내가 평가자인 건만 (팀장은 자기에 대한 상향 평가 건을 볼 수 없다: 평가자가 아니므로)
export const casesOf = (store: EvaluationStore, evaluatorNo: string) =>
  store.cases.filter((item) => item.evaluatorNo === evaluatorNo)

// 평가 대상 (저장소면 my_targets로 받은 대상, 가짜 데이터면 people.ts)
export const targetOf = (store: EvaluationStore, item: EvaluationCase): Person | undefined =>
  store.server ? store.server.targets[item.id] : findPerson(item.targetNo)

// 이 건의 문항 (평가표 순서). 저장소는 012로 받은 문항 세트, 가짜 데이터는 evaluations.ts 규칙
export function questionsFor(store: EvaluationStore, item: EvaluationCase): Question[] {
  if (!store.server) return questionsOf(item)
  const set = store.server.details[item.id]?.questionSet
  return store.server.questions
    .filter((question) => question.questionSet === set)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

// 서술형 화면 (10-데이터설계 계산 규칙 2): 저장소는 단계와 대상 역할로 정한다 (evaluations.ts essayModeOf와 같은 규칙)
export function essayModeFor(store: EvaluationStore, item: EvaluationCase): EssayMode {
  if (!store.server) return essayModeOf(item)
  if (item.stage === "upward" || item.stage === "exec_upward") return "none"
  if (item.stage === "self") return "self"
  const role = store.server.details[item.id]?.targetRole
  const direct = (role === "member" && item.stage === "leader") || (role === "leader" && item.stage === "executive")
  return direct ? "score" : "read"
}

// 화면에서 고치는 중인 답 (저장 전)
export type Draft = {
  answers: Record<number, { score: number | null; essay: string | null }> // 문항 번호 → 답
  opinion: string
}

// 저장된 답을 작성 화면의 입력값으로 옮긴다
export function draftOf(store: EvaluationStore, caseId: number): Draft {
  const answers: Draft["answers"] = {}
  for (const answer of store.answers) {
    if (answer.caseId === caseId) {
      answers[answer.questionId] = { score: answer.score, essay: answer.essay }
    }
  }
  return { answers, opinion: findCase(store, caseId)?.opinion ?? "" }
}

// 이 건에서 답해야 하는 문항: 서술형을 읽기만 하는 평가자는 서술형을 빼고 센다
export const requiredQuestionsOf = (store: EvaluationStore, item: EvaluationCase) =>
  questionsFor(store, item).filter(
    (question) => question.type === "choice" || essayModeFor(store, item) !== "read",
  )

// 답이 다 들어 있는지. 객관식 1~5 / 서술형 0~배점 (자기평가는 서술 내용도 필요)
export function isAnswered(
  store: EvaluationStore,
  item: EvaluationCase,
  question: Question,
  answer: Draft["answers"][number] | undefined,
) {
  const score = answer?.score
  if (score === null || score === undefined) return false
  if (question.type === "choice") return Number.isInteger(score) && score >= 1 && score <= 5
  if (score < 0 || score > question.factorPoints) return false
  return essayModeFor(store, item) !== "self" || Boolean(answer?.essay?.trim())
}

// 진행률: 답한 문항 / 전체 문항
export function progressOf(store: EvaluationStore, item: EvaluationCase, draft: Draft) {
  const required = requiredQuestionsOf(store, item)
  const answered = required.filter((question) =>
    isAnswered(store, item, question, draft.answers[question.id]),
  ).length
  return { answered, total: required.length }
}

// 제출 전에 빠진 곳: 답이 없는 문항 번호(화면 순서대로)와 종합 의견 누락 여부 (자기평가엔 종합 의견 없음)
export function missingOf(store: EvaluationStore, item: EvaluationCase, draft: Draft) {
  return {
    questionIds: requiredQuestionsOf(store, item)
      .filter((question) => !isAnswered(store, item, question, draft.answers[question.id]))
      .map((question) => question.id),
    opinion: item.stage !== "self" && !draft.opinion.trim(),
  }
}

// 전 단계 완료 여부 (팀장·임원 카드 표시용). 자기·상향 평가는 전 단계가 없다.
// 팀장 평가 ← 대상의 자기평가 / 임원 평가 ← 팀원 대상은 팀장 평가, 팀장 대상은 자기평가
export function previousStageOf(store: EvaluationStore, item: EvaluationCase) {
  if (item.stage === "self" || item.stage === "upward" || item.stage === "exec_upward") return null
  if (store.server) {
    const done = store.server.previousDone[item.id]
    if (done === null || done === undefined) return null
    const role = store.server.targets[item.id]?.role
    return { label: item.stage === "executive" && role === "member" ? "팀장 평가" : "자기평가", done }
  }
  const ofTarget = (stage: EvaluationCase["stage"]) =>
    store.cases.find((other) => other.targetNo === item.targetNo && other.stage === stage)
  const previous =
    item.stage === "executive" && ofTarget("leader") ? ofTarget("leader") : ofTarget("self")
  if (!previous) return null
  return {
    label: previous.stage === "leader" ? "팀장 평가" : "자기평가",
    done: previous.status === "submitted",
  }
}

// 대상의 자기평가 서술형 답 (팀장·임원 화면에서 읽기용). 대상이 제출했을 때만 보여 준다.
export function targetSelfEssayOf(store: EvaluationStore, item: EvaluationCase) {
  if (store.server) return store.server.selfEssays[item.id] ?? null
  const selfCase = store.cases.find(
    (other) => other.targetNo === item.targetNo && other.stage === "self",
  )
  if (!selfCase || selfCase.status !== "submitted") return null
  const essayQuestion = questionsOf(selfCase).find((question) => question.type === "essay")
  const answer = store.answers.find(
    (other) => other.caseId === selfCase.id && other.questionId === essayQuestion?.id,
  )
  return answer ? { essay: answer.essay ?? "", score: answer.score } : null
}

// 내 평가 건의 최근 반려 사유. 서버 함수 my_return_reason과 같은 모양 (글자 하나, 없으면 null).
// 평가자 본인의 건일 때만 돌려준다 (저장소는 서버 함수가 확인한다)
export function returnReasonOf(
  store: EvaluationStore,
  caseId: number,
  myEmployeeNo: string,
): string | null {
  if (store.server) return store.server.returnReasons[caseId] ?? null
  if (findCase(store, caseId)?.evaluatorNo !== myEmployeeNo) return null
  return returnReasons[caseId] ?? null
}

// 지금 작성할 수 없는 이유 (할 수 있으면 null). 저장소는 회차가 "평가 중"일 때만 답·제출을 받는다 (잠금 장치 3·4)
export function writeBlockedReason(store: EvaluationStore) {
  if (!store.server) return null
  if (store.server.cycle.status !== "in_progress") return "평가 중일 때만 작성할 수 있습니다."
  if (store.server.needsSql) return "문항을 불러오려면 SQL 012 실행이 필요합니다 (관리자에게 문의)."
  return null
}

// ---------- 저장 (되면 null, 안 되면 화면 문구) ----------

// 제출 시각 (예: 2026-11-03T14:20:05)
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

const answerRows = (draft: Draft) =>
  Object.entries(draft.answers)
    .filter(([, answer]) => answer.score !== null || Boolean(answer.essay))
    .map(([questionId, answer]) => ({ questionId: Number(questionId), score: answer.score, essay: answer.essay }))

function saveAnswers(caseId: number, draft: Draft, changes: Partial<EvaluationCase>) {
  const kept = state.answers.filter((answer) => answer.caseId !== caseId)
  const next = answerRows(draft).map((answer) => ({ caseId, ...answer }))
  update({
    ...state,
    cases: state.cases.map((item) =>
      item.id === caseId ? { ...item, opinion: draft.opinion, ...changes } : item,
    ),
    answers: [...kept, ...next],
  })
}

const LOCKED = "이미 제출한 평가는 고칠 수 없습니다."

// 저장소에 쓰고 다시 읽는다. 실패하면 저장소 문구 (실패해도 다시 읽는다)
async function serverWrite(write: () => Promise<void>) {
  const name = state.server?.me.name ?? ""
  try {
    await write()
    await reloadServer(name)
    return null
  } catch (caught) {
    const message = messageOf(caught)
    try {
      await reloadServer(name)
    } catch {
      // 다시 읽기도 실패하면 화면은 그대로 둔다
    }
    return message
  }
}

// 임시 저장: 상태 "작성 중". 반려된 건은 다시 제출할 때까지 "반려"로 둔다 (화면 위 반려 안내 유지)
// 저장소: 반려 건은 답만 저장한다 (평가 건 상태를 "반려"로 다시 둘 수는 없어서 건드리지 않는다)
export async function saveDraft(caseId: number, draft: Draft): Promise<string | null> {
  const item = findCase(state, caseId)
  if (!item || item.status === "submitted") return LOCKED
  if (state.server) {
    const blocked = writeBlockedReason(state)
    if (blocked) return blocked
    return serverWrite(async () => {
      await saveMyAnswers(caseId, answerRows(draft))
      if (item.status !== "returned") {
        await updateMyCase(caseId, { status: "in_progress", opinion: item.stage === "self" ? null : draft.opinion })
      }
    })
  }
  saveAnswers(caseId, draft, {
    status: item.status === "returned" ? "returned" : "in_progress",
  })
  return null
}

// 제출: 빠진 곳이 없을 때만. 상태 "제출" + 제출 시각
// 자기평가는 만족도 제출도 끝나야 한다 (docs/12 임시 결정 2. 서버 규칙에는 없어 여기서 막는다)
export async function submitCase(caseId: number, draft: Draft): Promise<string | null> {
  const item = findCase(state, caseId)
  if (!item || item.status === "submitted") return LOCKED
  const missing = missingOf(state, item, draft)
  if (missing.questionIds.length || missing.opinion) return "빠진 곳을 채워야 제출할 수 있습니다."
  if (item.stage === "self" && extrasMissingOf(state, item.targetNo).satisfaction)
    return "만족도를 제출해야 자기평가를 제출할 수 있습니다."
  if (state.server) {
    const blocked = writeBlockedReason(state)
    if (blocked) return blocked
    return serverWrite(async () => {
      await saveMyAnswers(caseId, answerRows(draft))
      await updateMyCase(caseId, { status: "submitted", opinion: item.stage === "self" ? null : draft.opinion.trim() })
    })
  }
  saveAnswers(caseId, draft, { status: "submitted", submittedAt: nowText() })
  return null
}

// ---------- 건의 · 만족도 (docs/12-평가작성추가.md) ----------

export type ExtraResult = { ok: true } | { ok: false; message: string }

// 지금 받을 수 없는 이유 (받을 수 있으면 null). 서버 cycle_is_open과 같은 기준: 평가 중 + 결과 공개 전.
// 저장소면 그 회차, 가짜 데이터면 평가 설정과 scores-store의 결과 공개 여부(화면이 넘긴다)
export function extrasBlockedReason(resultPublished: boolean) {
  const cycle = state.server?.cycle
  const inProgress = cycle ? cycle.status === "in_progress" : evaluationSetting.status === "평가 중"
  if (!inProgress) return "평가 중일 때만 제출할 수 있습니다."
  if (cycle ? cycle.resultPublished : resultPublished) return "결과가 공개된 뒤에는 제출할 수 없습니다."
  return null
}

export const hasSubmittedSatisfaction = (store: EvaluationStore, employeeNo: string) =>
  store.satisfactionDone.includes(employeeNo)

// 건의 보내기: 추가만 (여러 번 가능, 임시 결정 7). 작성자를 알 수 없게 내용은 이 화면에 남기지 않는다.
// 저장소: suggestions 표에 회차·내용 두 칸만 추가한다
export async function sendSuggestion(content: string, resultPublished: boolean): Promise<ExtraResult> {
  const blocked = extrasBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (!content.trim()) return { ok: false, message: "건의 내용을 입력해 주세요." }
  const server = state.server
  if (server) {
    try {
      await sendMySuggestion(server.cycle.id, content.trim())
    } catch (caught) {
      return { ok: false, message: messageOf(caught) }
    }
  }
  update({ ...state, suggestionCount: state.suggestionCount + 1 })
  return { ok: true }
}

// 만족도 제출: 서버 함수 submit_satisfaction과 같은 순서·문구로 확인한다.
// 제출 여부만 남기고 점수·의견은 남기지 않는다 (작성자를 알 수 없게). 저장소는 rpc("submit_satisfaction")
export async function submitSatisfaction(
  employeeNo: string,
  score: number | null,
  comment: string,
  resultPublished: boolean,
): Promise<ExtraResult> {
  if (!employeeNo) return { ok: false, message: "직원 계정으로 로그인해야 합니다." }
  const blocked = extrasBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (score === null || !Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, message: "점수는 1~5 중에서 골라 주세요." }
  if (hasSubmittedSatisfaction(state, employeeNo))
    return { ok: false, message: "이미 만족도를 제출했습니다." }
  const server = state.server
  if (server) {
    try {
      await submitMySatisfaction(server.cycle.id, score, comment)
    } catch (caught) {
      return { ok: false, message: messageOf(caught) }
    }
  }
  update({ ...state, satisfactionDone: [...state.satisfactionDone, employeeNo] })
  return { ok: true }
}

// 자기평가 [제출] 조건 (임시 결정 2): 만족도 제출. 자기평가 건의 대상 사원번호로 확인한다
export const extrasMissingOf = (store: EvaluationStore, employeeNo: string) => ({
  satisfaction: !hasSubmittedSatisfaction(store, employeeNo),
})
