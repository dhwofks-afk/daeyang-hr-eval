// 평가 작성 저장 자리 (docs/06-평가작성.md). 목록 화면과 작성 화면이 함께 쓴다.
// 처음 값은 src/data/evaluations.ts에서 복사한다. evaluations.ts는 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase 읽기·쓰기로 바꾼다.
// 점수는 계산하지 않는다 (scoring.ts가 함). 이 파일은 답을 저장하고 빠진 곳만 찾는다.
// 자기관찰 · 건의 · 만족도(docs/12-평가작성추가.md)도 여기서 받는다.
import { useSyncExternalStore } from "react"
import {
  essayModeOf,
  evaluationAnswers,
  evaluationCases,
  questionsOf,
  returnReasons,
  satisfactionDone,
  selfObservations,
  type Answer,
  type EvaluationCase,
  type Question,
  type SelfObservation,
} from "@/data/evaluations"
import { departments, evaluationSetting } from "@/data/scores"

export type EvaluationStore = {
  cases: EvaluationCase[]
  answers: Answer[]
  selfObservations: SelfObservation[] // 자기관찰: 사람마다 한 줄
  satisfactionDone: string[] // 만족도를 낸 사람 (내용은 없음)
  suggestionCount: number // 이번 화면에서 보낸 건의 수 (내용·작성자는 남기지 않음)
}

let state: EvaluationStore = {
  cases: [...evaluationCases],
  answers: [...evaluationAnswers],
  selfObservations: [...selfObservations],
  satisfactionDone: [...satisfactionDone],
  suggestionCount: 0,
}

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

// ---------- 읽기 ----------

export const findCase = (store: EvaluationStore, caseId: number) =>
  store.cases.find((item) => item.id === caseId)

// 내가 평가자인 건만 (팀장은 자기에 대한 상향 평가 건을 볼 수 없다: 평가자가 아니므로)
export const casesOf = (store: EvaluationStore, evaluatorNo: string) =>
  store.cases.filter((item) => item.evaluatorNo === evaluatorNo)

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
export const requiredQuestionsOf = (item: EvaluationCase) =>
  questionsOf(item).filter(
    (question) => question.type === "choice" || essayModeOf(item) !== "read",
  )

// 답이 다 들어 있는지. 객관식 1~5 / 서술형 0~배점 (자기평가는 서술 내용도 필요)
export function isAnswered(
  item: EvaluationCase,
  question: Question,
  answer: Draft["answers"][number] | undefined,
) {
  const score = answer?.score
  if (score === null || score === undefined) return false
  if (question.type === "choice") return Number.isInteger(score) && score >= 1 && score <= 5
  if (score < 0 || score > question.factorPoints) return false
  return essayModeOf(item) !== "self" || Boolean(answer?.essay?.trim())
}

// 진행률: 답한 문항 / 전체 문항
export function progressOf(item: EvaluationCase, draft: Draft) {
  const required = requiredQuestionsOf(item)
  const answered = required.filter((question) =>
    isAnswered(item, question, draft.answers[question.id]),
  ).length
  return { answered, total: required.length }
}

// 제출 전에 빠진 곳: 답이 없는 문항 번호(화면 순서대로)와 평가 의견 누락 여부
export function missingOf(item: EvaluationCase, draft: Draft) {
  return {
    questionIds: requiredQuestionsOf(item)
      .filter((question) => !isAnswered(item, question, draft.answers[question.id]))
      .map((question) => question.id),
    opinion: !draft.opinion.trim(),
  }
}

// 전 단계 완료 여부 (팀장·임원 카드 표시용). 자기·상향 평가는 전 단계가 없다.
// 팀장 평가 ← 대상의 자기평가 / 임원 평가 ← 팀원 대상은 팀장 평가, 팀장 대상은 자기평가
export function previousStageOf(store: EvaluationStore, item: EvaluationCase) {
  if (item.stage === "self" || item.stage === "upward") return null
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
// 서버처럼 평가자 본인의 건일 때만 돌려준다. 11/4에 supabase.rpc("my_return_reason", { p_case_id })로 바꾼다.
export function returnReasonOf(
  store: EvaluationStore,
  caseId: number,
  myEmployeeNo: string,
): string | null {
  if (findCase(store, caseId)?.evaluatorNo !== myEmployeeNo) return null
  return returnReasons[caseId] ?? null
}

// ---------- 저장 (제출한 건은 false를 돌려주고 바꾸지 않는다) ----------

// 제출 시각 (예: 2026-11-03T14:20:05)
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

function saveAnswers(caseId: number, draft: Draft, changes: Partial<EvaluationCase>) {
  const kept = state.answers.filter((answer) => answer.caseId !== caseId)
  const next = Object.entries(draft.answers)
    .filter(([, answer]) => answer.score !== null || Boolean(answer.essay))
    .map(([questionId, answer]) => ({
      caseId,
      questionId: Number(questionId),
      score: answer.score,
      essay: answer.essay,
    }))
  update({
    ...state,
    cases: state.cases.map((item) =>
      item.id === caseId ? { ...item, opinion: draft.opinion, ...changes } : item,
    ),
    answers: [...kept, ...next],
  })
}

// 임시 저장: 상태 "작성 중". 반려된 건은 다시 제출할 때까지 "반려"로 둔다 (화면 위 반려 안내 유지)
export function saveDraft(caseId: number, draft: Draft) {
  const item = findCase(state, caseId)
  if (!item || item.status === "submitted") return false
  saveAnswers(caseId, draft, {
    status: item.status === "returned" ? "returned" : "in_progress",
  })
  return true
}

// 제출: 빠진 곳이 없을 때만. 상태 "제출" + 제출 시각
export function submitCase(caseId: number, draft: Draft) {
  const item = findCase(state, caseId)
  if (!item || item.status === "submitted") return false
  const missing = missingOf(item, draft)
  if (missing.questionIds.length || missing.opinion) return false
  saveAnswers(caseId, draft, { status: "submitted", submittedAt: nowText() })
  return true
}

// ---------- 자기관찰 · 건의 · 만족도 (docs/12-평가작성추가.md) ----------

export type ExtraResult = { ok: true } | { ok: false; message: string }

// 희망 부서로 고를 수 있는 부서 (임시 결정 5: 부서 목록에서 고르기)
export const departmentNames = departments.map((department) => department.name)

// 지금 받을 수 없는 이유 (받을 수 있으면 null). 서버 cycle_is_open과 같은 기준: 평가 중 + 결과 공개 전.
// 결과 공개 여부는 scores-store의 값을 화면이 넘긴다 (진행 관리 [반려]와 같은 기준)
export function extrasBlockedReason(resultPublished: boolean) {
  if (evaluationSetting.status !== "평가 중") return "평가 중일 때만 제출할 수 있습니다."
  if (resultPublished) return "결과가 공개된 뒤에는 제출할 수 없습니다."
  return null
}

// 내 자기평가 건 (팀원·팀장만 있다. 임원은 없음 → 이번 범위 제외)
export const selfCaseOf = (store: EvaluationStore, employeeNo: string) =>
  store.cases.find((item) => item.stage === "self" && item.targetNo === employeeNo)

export const selfObservationOf = (store: EvaluationStore, employeeNo: string) =>
  store.selfObservations.find((row) => row.employeeNo === employeeNo)

export const hasSubmittedSatisfaction = (store: EvaluationStore, employeeNo: string) =>
  store.satisfactionDone.includes(employeeNo)

// 자기관찰은 자기평가를 제출한 뒤에는 읽기 전용 (임시 결정 3). 반려되면 다시 고칠 수 있다
export const observationLocked = (store: EvaluationStore, employeeNo: string) =>
  selfCaseOf(store, employeeNo)?.status === "submitted"

// 자기관찰 점수 6개 (서버에서 비울 수 없다). 이동 희망만 1~4
export const observationScoreKeys = [
  "workload",
  "difficulty",
  "aptitude",
  "satisfaction",
  "relationships",
  "transferWish",
] as const
export type ObservationScoreKey = (typeof observationScoreKeys)[number]

const maxScoreOf = (key: ObservationScoreKey) => (key === "transferWish" ? 4 : 5)

// 화면에서 고치는 중인 자기관찰 (저장 전)
export type ObservationDraft = Record<ObservationScoreKey, number | null> & {
  wishDepartment: string | null
  mainWork: string
  otherOpinion: string
}

export function observationDraftOf(store: EvaluationStore, employeeNo: string): ObservationDraft {
  const saved = selfObservationOf(store, employeeNo)
  return {
    workload: saved?.workload ?? null,
    difficulty: saved?.difficulty ?? null,
    aptitude: saved?.aptitude ?? null,
    satisfaction: saved?.satisfaction ?? null,
    relationships: saved?.relationships ?? null,
    transferWish: saved?.transferWish ?? null,
    wishDepartment: saved?.wishDepartment ?? null,
    mainWork: saved?.mainWork ?? "",
    otherOpinion: saved?.otherOpinion ?? "",
  }
}

// 저장 전에 빠지거나 틀린 곳: 고르지 않은 점수와 목록에 없는 희망 부서
export function observationProblems(draft: ObservationDraft) {
  return {
    missingScores: observationScoreKeys.filter((key) => {
      const value = draft[key]
      return value === null || !Number.isInteger(value) || value < 1 || value > maxScoreOf(key)
    }),
    badDepartment:
      draft.wishDepartment !== null && !departmentNames.includes(draft.wishDepartment),
  }
}

const textOrNull = (value: string) => value.trim() || null

// 자기관찰 저장: 없으면 추가, 있으면 고치기 (self_observations 한 줄)
export function saveSelfObservation(
  employeeNo: string,
  draft: ObservationDraft,
  resultPublished: boolean,
): ExtraResult {
  const blocked = extrasBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (!selfCaseOf(state, employeeNo)) return { ok: false, message: "자기평가 대상만 자기관찰을 쓸 수 있습니다." }
  if (observationLocked(state, employeeNo))
    return { ok: false, message: "자기평가를 제출해 자기관찰을 고칠 수 없습니다." }
  const problems = observationProblems(draft)
  if (problems.missingScores.length) return { ok: false, message: "점수 6개를 모두 골라 주세요." }
  if (problems.badDepartment) return { ok: false, message: "희망 부서는 목록에서 골라 주세요." }

  const row: SelfObservation = {
    employeeNo,
    workload: draft.workload as number,
    difficulty: draft.difficulty as number,
    aptitude: draft.aptitude as number,
    satisfaction: draft.satisfaction as number,
    relationships: draft.relationships as number,
    transferWish: draft.transferWish as number,
    wishDepartment: draft.wishDepartment,
    mainWork: textOrNull(draft.mainWork),
    otherOpinion: textOrNull(draft.otherOpinion),
  }
  update({
    ...state,
    selfObservations: [
      ...state.selfObservations.filter((other) => other.employeeNo !== employeeNo),
      row,
    ],
  })
  return { ok: true }
}

// 건의 보내기: 추가만 (여러 번 가능, 임시 결정 7). 작성자를 알 수 없게 내용은 이 화면에 남기지 않는다.
// 11/4에 suggestions 표에 회차·내용 두 칸만 추가하는 것으로 바꾼다.
export function sendSuggestion(content: string, resultPublished: boolean): ExtraResult {
  const blocked = extrasBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (!content.trim()) return { ok: false, message: "건의 내용을 입력해 주세요." }
  update({ ...state, suggestionCount: state.suggestionCount + 1 })
  return { ok: true }
}

// 만족도 제출: 서버 함수 submit_satisfaction과 같은 순서·문구로 확인한다.
// 제출 여부만 남기고 점수·의견은 남기지 않는다 (작성자를 알 수 없게). 11/4에 rpc("submit_satisfaction")로 바꾼다.
export function submitSatisfaction(
  employeeNo: string,
  score: number | null,
  _comment: string,
  resultPublished: boolean,
): ExtraResult {
  if (!employeeNo) return { ok: false, message: "직원 계정으로 로그인해야 합니다." }
  const blocked = extrasBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (score === null || !Number.isInteger(score) || score < 1 || score > 5)
    return { ok: false, message: "점수는 1~5 중에서 골라 주세요." }
  if (hasSubmittedSatisfaction(state, employeeNo))
    return { ok: false, message: "이미 만족도를 제출했습니다." }
  update({ ...state, satisfactionDone: [...state.satisfactionDone, employeeNo] })
  return { ok: true }
}

// 자기평가 [제출] 조건 (임시 결정 2): 자기관찰 저장 + 만족도 제출. 4단계에서 제출에 연결한다
export const extrasMissingOf = (store: EvaluationStore, employeeNo: string) => ({
  observation: !selfObservationOf(store, employeeNo),
  satisfaction: !hasSubmittedSatisfaction(store, employeeNo),
})
