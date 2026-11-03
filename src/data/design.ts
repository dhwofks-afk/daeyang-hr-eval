// 평가 설계 저장 자리 (평가 설계 문서 4번). 회차(평가 설정)와 문항 편집용 목록을 둔다.
// - 실제 관리자 로그인: 저장소(Supabase)에서 읽고 쓴다 (src/lib/admin-data.ts). 지금 회차 카드 하나만 보인다
// - 역할 미리보기: 가짜 데이터. 처음 값은 src/data/scores.ts(평가 설정)와 src/data/evaluations.ts(문항)에서 복사하고,
//   고친 내용은 화면 메모리에만 있어 새로고침하면 처음으로 돌아간다
import { useEffect, useSyncExternalStore } from "react"
import {
  isAdminSession,
  loadCurrentCycle,
  loadQuestions,
  loadTargetSummary,
  saveCycleSettings,
  saveQuestionSet,
  startCycle,
  updateDeadline,
} from "@/lib/admin-data"
import { type Weights } from "@/lib/scoring"
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
  // checking: 실제 관리자 로그인인지 확인 중 / loading: 저장소에서 읽는 중 / fake: 가짜 데이터 / server: 저장소
  source: "checking" | "loading" | "fake" | "server" | "error"
  error: string | null
  cycleId: number | null // 저장소 회차 번호 (가짜 데이터면 null)
  rounds: Round[]
  questions: Question[]
  // 평가 대상 수 (저장소 기준: 재직·평가 제외 아님, 임원 포함). 가짜 데이터면 null → 직원 명단으로 센다
  targets: { total: number; excluded: number; target: number } | null
  // 저장소 회차의 단계 비율 (평가 기본 설정 화면 표시용). 가짜 데이터면 null → 점수·보정 저장 자리 값
  weights: Weights | null
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
const fakeState = (): DesignState => ({
  source: "fake",
  error: null,
  cycleId: null,
  targets: null,
  weights: null,
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
})

let state: DesignState = { ...fakeState(), source: "checking" }

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

// ---------- 저장소 연결 ----------

const statusLabels = { before: "평가 전", in_progress: "평가 중", done: "평가 완료" } as const

async function reloadServer() {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("회차가 없습니다.")
  const [list, targets] = await Promise.all([loadQuestions(cycle.id), loadTargetSummary()])
  update({
    source: "server",
    error: null,
    cycleId: cycle.id,
    rounds: [
      {
        round: cycle.id,
        name: cycle.name,
        status: statusLabels[cycle.status],
        startDate: cycle.startDate,
        deadline: cycle.deadline,
        targetCount: null,
      },
    ],
    questions: list,
    targets,
    weights: cycle.weights,
  })
}

// 페이지를 열 때마다 확인한다: 실제 관리자면 저장소에서 읽고, 아니면 가짜 데이터
// (가짜 데이터에서 고친 내용은 페이지를 옮겨도 남겨 둔다)
async function connect() {
  if (!(await isAdminSession())) {
    if (state.source !== "fake") update(fakeState())
    return
  }
  if (state.source !== "server") update({ ...state, source: "loading" })
  try {
    await reloadServer()
  } catch (caught) {
    update({ ...state, source: "error", error: messageOf(caught) })
  }
}

// 평가 목록·문항 편집 페이지가 열릴 때 부른다
export function useDesignConnection() {
  useEffect(() => {
    void connect()
  }, [])
}

// 화면을 그릴 수 있는 상태인지 (확인·읽는 중이거나 오류면 false)
export const isDesignReady = (current: DesignState) =>
  current.source === "fake" || current.source === "server"

const messageOf = (caught: unknown) => (caught instanceof Error ? caught.message : String(caught))
const NOT_SAVED = "저장하지 못했습니다."

// 저장소에 쓰고 다시 읽는다. 되면 null, 안 되면 화면 문구 (실패해도 저장소 값을 다시 읽는다)
async function serverSave(write: (cycleId: number) => Promise<void>) {
  if (state.cycleId === null) return NOT_SAVED
  try {
    await write(state.cycleId)
    await reloadServer()
    return null
  } catch (caught) {
    const reason = messageOf(caught)
    try {
      await reloadServer()
    } catch {
      // 다시 읽기도 실패하면 화면은 그대로 둔다
    }
    return `${NOT_SAVED} (${reason})`
  }
}

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

// 평가 대상 인원.
// - 저장소: 재직 직원(임원 포함) 중 평가 제외가 아닌 사람 (읽어 둔 값)
// - 가짜 데이터: 임원을 뺀 직원 중 평가 제외가 아닌 사람. people.ts에는 평가 제외 칸이 없어서, 칸이 없으면 제외 아님으로 센다.
export function targetSummary() {
  if (state.targets) return state.targets
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

// ---------- 저장 ----------
// saveRoundSettings·startRound·commitQuestionSet은 저장소면 결과를 기다린다: 되면 null, 안 되면 화면 문구.
// 나머지(가짜 데이터 전용)는 바꿀 수 없는 상태면 false를 돌려주고 바꾸지 않는다.

function changeRound(roundNo: number, change: (round: Round) => Round) {
  update({
    ...state,
    rounds: state.rounds.map((round) => (round.round === roundNo ? change(round) : round)),
  })
}

const ENDED = "끝난 평가는 수정할 수 없습니다."

// 평가 전: 이름·시작일·마감일 / 평가 중: 마감일만 / 평가 완료: 수정 불가
export async function saveRoundSettings(
  roundNo: number,
  values: { name: string; startDate: string | null; deadline: string | null },
): Promise<string | null> {
  const round = state.rounds.find((item) => item.round === roundNo)
  if (!round || round.status === "평가 완료") return ENDED
  if (state.source === "server") {
    if (round.status === "평가 전") return serverSave((cycleId) => saveCycleSettings(cycleId, values))
    if (!values.deadline) return "평가 중에는 마감일을 비울 수 없습니다."
    const deadline = values.deadline
    return serverSave((cycleId) => updateDeadline(cycleId, deadline))
  }
  changeRound(roundNo, (item) =>
    item.status === "평가 전" ? { ...item, ...values } : { ...item, deadline: values.deadline },
  )
  return null
}

// ---------- 문항 (평가 전에만 바꿀 수 있다) ----------

export type QuestionValues = Pick<Question, "field" | "factor" | "factorPoints" | "content" | "type">

const editable = () => currentRound(state).status === "평가 전"

// 한 세트를 화면 순서(분야 → 평정요소 → 문항)대로 한 줄로 편다
const flatten = (list: Question[], set: QuestionSet) =>
  groupQuestions(list, set).flatMap((field) => field.factors.flatMap((factor) => factor.questions))

// 한 세트의 순서를 1부터 다시 매긴 새 목록 (다른 세트는 그대로)
function withSetOrder(list: Question[], set: QuestionSet, ordered: Question[]) {
  return [
    ...list.filter((question) => question.questionSet !== set),
    ...ordered.map((question, index) => ({ ...question, sortOrder: index + 1 })),
  ]
}

const sameFactor = (a: QuestionValues, b: QuestionValues) =>
  a.field === b.field && a.factor === b.factor

// ----- 목록 계산 (저장하지 않는다) -----
// 아래 함수들은 문항 목록(여러 세트)을 받아 고친 새 목록을 돌려준다.
// 저장 자리의 saveQuestion·deleteQuestion·moveQuestion·replaceQuestions와
// 문항 편집 화면의 작업 사본([완료] 전)이 같은 규칙을 쓰도록 나눠 둔다.

// 문항 추가(id 없음)·수정. 새 문항은 같은 평정요소 맨 뒤(없으면 같은 분야 맨 뒤, 그것도 없으면 세트 맨 뒤)에 놓는다.
// 평정요소 배점은 같은 평정요소의 모든 문항에 함께 적용한다.
export function withSavedQuestion(
  list: Question[],
  set: QuestionSet,
  values: QuestionValues,
  id?: number,
) {
  const before = list.find((question) => question.id === id)
  const ordered = flatten(
    list.filter((question) => question.id !== id),
    set,
  )
  const saved: Question = {
    id: before?.id ?? Math.max(0, ...list.map((question) => question.id)) + 1,
    questionSet: set,
    ...values,
    sortOrder: 0,
  }

  if (before && sameFactor(before, values)) {
    ordered.splice(flatten(list, set).indexOf(before), 0, saved)
  } else {
    const lastIndex = (match: (question: Question) => boolean) =>
      ordered.reduce((found, question, index) => (match(question) ? index : found), -1)
    const lastFactor = lastIndex((question) => sameFactor(question, values))
    const lastField = lastIndex((question) => question.field === values.field)
    const at = lastFactor >= 0 ? lastFactor + 1 : lastField >= 0 ? lastField + 1 : ordered.length
    ordered.splice(at, 0, saved)
  }

  return withSetOrder(
    list,
    set,
    ordered.map((question) =>
      sameFactor(question, values) ? { ...question, factorPoints: values.factorPoints } : question,
    ),
  )
}

// 문항 삭제. 없는 번호면 null
export function withoutQuestion(list: Question[], id: number) {
  const target = list.find((question) => question.id === id)
  if (!target) return null
  return withSetOrder(
    list,
    target.questionSet,
    flatten(list, target.questionSet).filter((question) => question.id !== id),
  )
}

// 순서 바꾸기: id 문항을 targetId 문항 자리로 옮긴다. 같은 평정요소 안에서만 되고, 안 되면 null
export function withMovedQuestion(list: Question[], id: number, targetId: number) {
  const source = list.find((question) => question.id === id)
  const target = list.find((question) => question.id === targetId)
  if (
    !source ||
    !target ||
    source === target ||
    source.questionSet !== target.questionSet ||
    !sameFactor(source, target)
  )
    return null
  const ordered = flatten(list, source.questionSet)
  const targetIndex = ordered.indexOf(target)
  ordered.splice(ordered.indexOf(source), 1)
  ordered.splice(targetIndex, 0, source)
  return withSetOrder(list, source.questionSet, ordered)
}

// 엑셀(CSV)로 불러온 문항으로 한 세트를 통째로 바꾼다. 순서는 파일 순서를 따르되 분야 → 평정요소로 묶는다.
export function withReplacedSet(list: Question[], set: QuestionSet, values: QuestionValues[]) {
  const firstId = Math.max(0, ...list.map((question) => question.id)) + 1
  const added: Question[] = values.map((item, index) => ({
    id: firstId + index,
    questionSet: set,
    ...item,
    sortOrder: index + 1,
  }))
  return withSetOrder(list, set, flatten(added, set))
}

// ----- 저장 -----

export function saveQuestion(set: QuestionSet, values: QuestionValues, id?: number) {
  if (!editable()) return false
  update({ ...state, questions: withSavedQuestion(state.questions, set, values, id) })
  return true
}

export function deleteQuestion(id: number) {
  const next = editable() ? withoutQuestion(state.questions, id) : null
  if (!next) return false
  update({ ...state, questions: next })
  return true
}

export function moveQuestion(id: number, targetId: number) {
  const next = editable() ? withMovedQuestion(state.questions, id, targetId) : null
  if (!next) return false
  update({ ...state, questions: next })
  return true
}

export function replaceQuestions(set: QuestionSet, list: QuestionValues[]) {
  if (!editable()) return false
  update({ ...state, questions: withReplacedSet(state.questions, set, list) })
  return true
}

const LOCKED = "평가가 시작되어 문항을 수정할 수 없습니다."

// 문항 편집 화면의 [완료]: 작업 사본의 한 세트를 그대로 저장한다 (순서는 사본 그대로).
// 원래 있던 문항은 번호를 그대로 두고, 새로 넣은 문항만 새 번호를 붙인다
// (가짜 데이터: 저장 자리 기준으로 겹치지 않게 / 저장소: 저장소가 번호를 정한다).
export async function commitQuestionSet(set: QuestionSet, setQuestions: Question[]): Promise<string | null> {
  if (!editable()) return LOCKED
  if (state.source === "server") {
    const savedIds = state.questions.filter((question) => question.questionSet === set).map((question) => question.id)
    return serverSave((cycleId) =>
      saveQuestionSet(cycleId, set, setQuestions.map((question) => ({ ...question, questionSet: set })), savedIds),
    )
  }
  const kept = new Set(
    state.questions.filter((question) => question.questionSet === set).map((question) => question.id),
  )
  let nextId = Math.max(0, ...state.questions.map((question) => question.id))
  const saved = setQuestions.map((question) =>
    kept.has(question.id) ? { ...question, questionSet: set } : { ...question, questionSet: set, id: ++nextId },
  )
  update({
    ...state,
    questions: [...state.questions.filter((question) => question.questionSet !== set), ...saved],
  })
  return null
}

// 평가 시작: 평가 전 → 평가 중. 검사에 걸리면 화면 문구
// 저장소: start_cycle이 평가 건이 없으면 규칙대로 만든 뒤 시작한다 (시작 후에는 문항을 바꿀 수 없다)
export async function startRound(roundNo: number): Promise<string | null> {
  const round = state.rounds.find((item) => item.round === roundNo)
  const NOT_STARTED = "평가를 시작할 수 없습니다. 카드의 안내를 확인해 주세요."
  if (!round || round.status !== "평가 전" || startProblems(state, round).length) return NOT_STARTED
  if (state.source === "server") {
    const { startDate, deadline } = round
    if (!startDate || !deadline) return NOT_STARTED
    return serverSave((cycleId) => startCycle(cycleId, startDate, deadline))
  }
  changeRound(roundNo, (item) => ({ ...item, status: "평가 중" }))
  return null
}
