// 평가 작성 저장 자리 (docs/06-평가작성.md). 목록 화면과 작성 화면이 함께 쓴다.
// 처음 값은 src/data/evaluations.ts에서 복사한다. evaluations.ts는 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase 읽기·쓰기로 바꾼다.
// 점수는 계산하지 않는다 (scoring.ts가 함). 이 파일은 답을 저장하고 빠진 곳만 찾는다.
import { useSyncExternalStore } from "react"
import {
  essayModeOf,
  evaluationAnswers,
  evaluationCases,
  questionsOf,
  returnReasons,
  type Answer,
  type EvaluationCase,
  type Question,
} from "@/data/evaluations"

export type EvaluationStore = {
  cases: EvaluationCase[]
  answers: Answer[]
}

let state: EvaluationStore = {
  cases: [...evaluationCases],
  answers: [...evaluationAnswers],
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
