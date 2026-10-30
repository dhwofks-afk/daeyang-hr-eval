// 평가 설계 저장 자리 (평가 설계 문서 4번, 가짜 데이터 단계)
// 회차(평가 설정)와 문항 편집용 목록을 둔다.
// 처음 값은 src/data/scores.ts(평가 설정)와 src/data/evaluations.ts(문항)에서 복사한다. 두 파일은 읽기만 한다.
// 고친 내용은 화면 메모리에만 있어 새로고침하면 처음으로 돌아간다. 실제 연결 때 이 파일만 Supabase 읽기·쓰기로 바꾼다.
import { useSyncExternalStore } from "react"
import { questions, type Question, type QuestionSet } from "@/data/evaluations"
import { people, type Person } from "@/data/people"
import { evaluationSetting } from "@/data/scores"

export type RoundStatus = "평가 전" | "평가 중" | "평가 완료"

export type Round = {
  round: number
  name: string
  status: RoundStatus
  startDate: string | null // 예: 2026-11-03. 미정이면 null
  deadline: string | null
  // 대상 인원. 현재 회차는 직원 명단으로 세므로 null, 지난 회차는 그때 인원을 적어 둔다
  targetCount: number | null
}

export type DesignState = {
  rounds: Round[]
  questions: Question[]
}

// 문항 세트 5종 (10-데이터설계 4번 표의 이름, 화면 표시 순서)
export const questionSets: { key: QuestionSet; label: string }[] = [
  { key: "office_member", label: "관리직-팀원" },
  { key: "office_leader", label: "관리직-팀장" },
  { key: "production_member", label: "생산직-팀원" },
  { key: "production_leader", label: "생산직-팀장" },
  { key: "upward", label: "상향" },
]

// 처음 값: 현재 회차는 평가 설정의 이름을 쓰고, 발표 장면에 맞춰 "평가 전"에서 시작한다.
// 지난 회차는 카드 상태 차이를 보여 주기 위한 가짜 회차다.
let state: DesignState = {
  rounds: [
    {
      round: evaluationSetting.round,
      name: evaluationSetting.name,
      status: "평가 전",
      startDate: null,
      deadline: null,
      targetCount: null,
    },
    {
      round: 0,
      name: "2025 정기 인사평가",
      status: "평가 완료",
      startDate: "2025-11-03",
      deadline: "2025-11-21",
      targetCount: 25,
    },
  ],
  questions: questions.map((question) => ({ ...question })),
}

const listeners = new Set<() => void>()

function update(next: DesignState) {
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
export const useDesignState = () => useSyncExternalStore(subscribe, () => state)

// ---------- 계산 ----------

// 상태 글자 → 클래스 이름 (띄어쓰기가 있는 글자를 클래스로 쓰지 않는다)
export const statusClass: Record<RoundStatus, string> = {
  "평가 전": "before",
  "평가 중": "ongoing",
  "평가 완료": "done",
}

// 지금 회차 = 목록의 첫 줄. 문항 편집은 이 회차의 상태로 잠근다.
export const currentRound = (current: DesignState) => current.rounds[0]

// 한 세트의 문항을 분야 → 평정요소로 묶는다. 순서는 문항 순서(sortOrder)를 따른다.
export function groupQuestions(list: Question[], set: QuestionSet) {
  const own = list
    .filter((question) => question.questionSet === set)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const fields: {
    field: string
    points: number
    factors: { factor: string; points: number; questions: Question[] }[]
  }[] = []
  for (const question of own) {
    let field = fields.find((item) => item.field === question.field)
    if (!field) {
      field = { field: question.field, points: 0, factors: [] }
      fields.push(field)
    }
    let factor = field.factors.find((item) => item.factor === question.factor)
    if (!factor) {
      factor = { factor: question.factor, points: question.factorPoints, questions: [] }
      field.factors.push(factor)
      field.points += question.factorPoints
    }
    factor.questions.push(question)
  }
  return fields
}

// 평가 대상 인원: 임원을 뺀 직원 중 평가 제외가 아닌 사람.
// people.ts에는 아직 평가 제외 칸이 없어서, 칸이 없으면 제외 아님으로 센다.
export function targetSummary() {
  const employees = people.filter((person) => person.role !== "executive")
  const excluded = employees.filter(
    (person: Person & { excluded?: boolean }) => person.excluded === true,
  ).length
  return { total: employees.length, excluded, target: employees.length - excluded }
}

// 문항 세트별 문항 수와 배점 합계. 배점은 평정요소마다 한 번만 더한다.
export function setSummary(list: Question[], set: QuestionSet) {
  const own = list.filter((question) => question.questionSet === set)
  const factorPoints = new Map(
    own.map((question) => [`${question.field}\u0000${question.factor}`, question.factorPoints]),
  )
  const points = [...factorPoints.values()].reduce((total, value) => total + value, 0)
  return { count: own.length, points }
}

// 평가 시작 전 검사. 문제가 없으면 빈 목록
export function startProblems(current: DesignState, round: Round) {
  const problems: string[] = []
  if (!round.startDate) problems.push("평가 시작일을 정해 주세요.")
  if (!round.deadline) problems.push("평가 마감일을 정해 주세요.")
  for (const set of questionSets) {
    const { points } = setSummary(current.questions, set.key)
    if (points !== 100) problems.push(`${set.label} 평가표 배점 합계가 ${points}점입니다. (100점이어야 함)`)
  }
  return problems
}

// ---------- 저장 (바꿀 수 없는 상태면 false를 돌려주고 바꾸지 않는다) ----------

function changeRound(roundNo: number, change: (round: Round) => Round) {
  update({
    ...state,
    rounds: state.rounds.map((round) => (round.round === roundNo ? change(round) : round)),
  })
}

// 평가 전: 이름·시작일·마감일 / 평가 중: 마감일만 / 평가 완료: 수정 불가
export function saveRoundSettings(
  roundNo: number,
  values: { name: string; startDate: string | null; deadline: string | null },
) {
  const round = state.rounds.find((item) => item.round === roundNo)
  if (!round || round.status === "평가 완료") return false
  changeRound(roundNo, (item) =>
    item.status === "평가 전" ? { ...item, ...values } : { ...item, deadline: values.deadline },
  )
  return true
}

// ---------- 문항 (평가 전에만 바꿀 수 있다) ----------

export type QuestionValues = Pick<Question, "field" | "factor" | "factorPoints" | "content" | "type">

const editable = () => currentRound(state).status === "평가 전"

// 한 세트를 화면 순서(분야 → 평정요소 → 문항)대로 한 줄로 편다
const flatten = (list: Question[], set: QuestionSet) =>
  groupQuestions(list, set).flatMap((field) => field.factors.flatMap((factor) => factor.questions))

// 한 세트의 순서를 1부터 다시 매기고 저장한다
function saveSetOrder(set: QuestionSet, ordered: Question[]) {
  update({
    ...state,
    questions: [
      ...state.questions.filter((question) => question.questionSet !== set),
      ...ordered.map((question, index) => ({ ...question, sortOrder: index + 1 })),
    ],
  })
}

const sameFactor = (a: QuestionValues, b: QuestionValues) =>
  a.field === b.field && a.factor === b.factor

// 문항 추가(id 없음)·수정. 새 문항은 같은 평정요소 맨 뒤(없으면 같은 분야 맨 뒤, 그것도 없으면 세트 맨 뒤)에 놓는다.
// 평정요소 배점은 같은 평정요소의 모든 문항에 함께 적용한다.
export function saveQuestion(set: QuestionSet, values: QuestionValues, id?: number) {
  if (!editable()) return false
  const before = state.questions.find((question) => question.id === id)
  const ordered = flatten(
    state.questions.filter((question) => question.id !== id),
    set,
  )
  const saved: Question = {
    id: before?.id ?? Math.max(0, ...state.questions.map((question) => question.id)) + 1,
    questionSet: set,
    ...values,
    sortOrder: 0,
  }

  if (before && sameFactor(before, values)) {
    ordered.splice(flatten(state.questions, set).indexOf(before), 0, saved)
  } else {
    const lastIndex = (match: (question: Question) => boolean) =>
      ordered.reduce((found, question, index) => (match(question) ? index : found), -1)
    const lastFactor = lastIndex((question) => sameFactor(question, values))
    const lastField = lastIndex((question) => question.field === values.field)
    const at = lastFactor >= 0 ? lastFactor + 1 : lastField >= 0 ? lastField + 1 : ordered.length
    ordered.splice(at, 0, saved)
  }

  saveSetOrder(
    set,
    ordered.map((question) =>
      sameFactor(question, values) ? { ...question, factorPoints: values.factorPoints } : question,
    ),
  )
  return true
}

export function deleteQuestion(id: number) {
  const target = state.questions.find((question) => question.id === id)
  if (!editable() || !target) return false
  saveSetOrder(
    target.questionSet,
    flatten(state.questions, target.questionSet).filter((question) => question.id !== id),
  )
  return true
}

// 순서 바꾸기: id 문항을 targetId 문항 자리로 옮긴다. 같은 평정요소 안에서만 된다.
export function moveQuestion(id: number, targetId: number) {
  const source = state.questions.find((question) => question.id === id)
  const target = state.questions.find((question) => question.id === targetId)
  if (
    !editable() ||
    !source ||
    !target ||
    source === target ||
    source.questionSet !== target.questionSet ||
    !sameFactor(source, target)
  )
    return false
  const ordered = flatten(state.questions, source.questionSet)
  const targetIndex = ordered.indexOf(target)
  ordered.splice(ordered.indexOf(source), 1)
  ordered.splice(targetIndex, 0, source)
  saveSetOrder(source.questionSet, ordered)
  return true
}

// 평가 시작: 평가 전 → 평가 중. 검사에 걸리면 false
export function startRound(roundNo: number) {
  const round = state.rounds.find((item) => item.round === roundNo)
  if (!round || round.status !== "평가 전" || startProblems(state, round).length) return false
  changeRound(roundNo, (item) => ({ ...item, status: "평가 중" }))
  return true
}
