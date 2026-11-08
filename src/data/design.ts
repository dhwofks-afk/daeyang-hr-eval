// 평가 설계 저장 자리 (평가 설계 문서 4번). 회차(평가 설정)와 문항 편집용 목록을 둔다.
// - 실제 관리자 로그인: 저장소(Supabase)에서 읽고 쓴다 (src/lib/admin-data.ts). 평가 카드는 모든 평가(016),
//   문항 편집은 문항 편집 화면 위의 평가 탭에서 고른 평가 (처음엔 가장 최근 "준비 중" 평가). 상단 평가 선택 상자와는 따로다
// - 역할 미리보기: 가짜 데이터. 처음 값은 src/data/scores.ts(평가 설정)와 src/data/evaluations.ts(문항)에서 복사하고,
//   고친 내용은 화면 메모리에만 있어 새로고침하면 처음으로 돌아간다
import { useEffect, useSyncExternalStore } from "react"
import {
  deleteCycle,
  isAdminSession,
  loadCycles,
  newCycle,
  type AdminCycle,
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

export type RoundStatus = "준비 중" | "평가 중" | "완료" | "결과 삭제됨"

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
  cycleId: number | null // 문항 편집에 쓰는 평가 번호 (평가 탭에서 고른 평가. 가짜 데이터는 처음 null = 첫 카드)
  rounds: Round[] // 평가 카드 (sortRounds 순서)
  questions: Question[] // 고른 평가(가짜 데이터는 첫 카드)의 문항
  // 평가별 문항 (평가 시작 전 검사용). 저장소만. 가짜 데이터는 비어 있어 questions를 쓴다
  roundQuestions: Record<number, Question[]>
  // 평가 대상 수 (저장소 기준: 재직·평가 제외 아님, 임원 포함). 가짜 데이터면 null → 직원 명단으로 센다
  targets: { total: number; excluded: number; target: number } | null
  // 저장소 회차의 단계 비율 (평가 기본 설정 화면 표시용). 가짜 데이터면 null → 점수·보정 저장 자리 값
  weights: Weights | null
}

// 문항 세트 3종 (10-데이터설계 4번 표의 이름, 화면 표시 순서)
export const questionSets: { key: QuestionSet; label: string }[] = [
  { key: "member", label: "팀원" },
  { key: "leader", label: "팀장" },
  { key: "upward", label: "상향" },
]

// 처음 값: 현재 회차는 평가 설정의 이름을 쓰고, 발표 장면에 맞춰 "평가 전"에서 시작한다.
// 지난 회차는 카드 상태 차이를 보여 주기 위한 가짜 회차다.
const fakeState = (): DesignState => ({
  source: "fake",
  error: null,
  cycleId: null,
  roundQuestions: {},
  targets: null,
  weights: null,
  rounds: [
    {
      round: evaluationSetting.round,
      name: evaluationSetting.name,
      status: "준비 중",
      startDate: null,
      deadline: null,
      targetCount: null,
    },
    {
      round: 0,
      name: "2025 정기 인사평가",
      status: "완료",
      startDate: "2025-11-03",
      deadline: "2025-11-21",
      targetCount: 25,
    },
  ],
  questions: questions.map((question) => ({ ...question })),
})

let state: DesignState = { ...fakeState(), source: "checking" }

const listeners = new Set<() => void>()

// 평가 카드·문항 편집 탭 순서: 평가 중·준비 중이 앞, 완료는 맨 뒤.
// 그 안에서는 시작일이 최근인 것이 앞. 시작일이 없으면 만든 날짜를 써야 하는데 평가 표에 만든 날짜 칸이 없어서,
// 시작일 없는 평가(아직 시작 전 = 가장 최근에 만든 평가)를 맨 앞에 두고 번호가 큰 것(나중에 만든 것)부터 둔다
export function sortRounds(rounds: Round[]) {
  const ended = (round: Round) => (round.status === "완료" || round.status === "결과 삭제됨" ? 1 : 0)
  return [...rounds].sort((a, b) => {
    if (ended(a) !== ended(b)) return ended(a) - ended(b)
    if (!a.startDate !== !b.startDate) return a.startDate ? 1 : -1
    if (a.startDate && b.startDate && a.startDate !== b.startDate) return a.startDate < b.startDate ? 1 : -1
    return b.round - a.round
  })
}

function update(next: DesignState) {
  state = { ...next, rounds: sortRounds(next.rounds) }
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

const statusLabels: Record<AdminCycle["status"], RoundStatus> = {
  before: "준비 중",
  in_progress: "평가 중",
  done: "완료",
  cleared: "결과 삭제됨",
}

// 문항 편집 평가 탭에서 고른 평가 (화면을 여는 동안만 기억한다)
let questionRoundId: number | null = null

async function reloadServer() {
  const [cycles, targets] = await Promise.all([loadCycles(), loadTargetSummary()])
  // 고른 평가 → 없으면 가장 최근 "준비 중" 평가 → 없으면 평가 중 → 가장 최근 평가 (목록은 번호가 큰 것부터)
  const cycle =
    cycles.find((item) => item.id === questionRoundId) ??
    cycles.find((item) => item.status === "before") ??
    cycles.find((item) => item.status === "in_progress") ??
    cycles[0]
  if (!cycle) throw new Error("평가가 없습니다.")
  const lists = await Promise.all(cycles.map((item) => loadQuestions(item.id)))
  const roundQuestions = Object.fromEntries(cycles.map((item, index) => [item.id, lists[index]]))
  update({
    source: "server",
    error: null,
    cycleId: cycle.id,
    rounds: cycles.map((item) => ({
      round: item.id,
      name: item.name,
      status: statusLabels[item.status],
      startDate: item.startDate,
      deadline: item.deadline,
      targetCount: null,
    })),
    questions: roundQuestions[cycle.id] ?? [],
    roundQuestions,
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
async function serverSave(write: () => Promise<void>) {
  try {
    await write()
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
  "준비 중": "before",
  "평가 중": "ongoing",
  "완료": "done",
  "결과 삭제됨": "done",
}

// 문항 편집에 쓰는 평가 = 고른 평가 (가짜 데이터는 목록의 첫 줄). 문항 편집은 이 평가의 상태로 잠근다.
export const currentRound = (current: DesignState) =>
  current.rounds.find((round) => round.round === current.cycleId) ?? current.rounds[0]

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
  const other = current.rounds.find((item) => item.status === "평가 중" && item.round !== round.round)
  if (other) problems.push(`"${other.name}" 평가가 평가 중입니다. 평가 중은 한 번에 하나만 둘 수 있습니다.`)
  const list = current.roundQuestions[round.round] ?? current.questions
  if (!round.startDate) problems.push("평가 시작일을 정해 주세요.")
  if (!round.deadline) problems.push("평가 마감일을 정해 주세요.")
  for (const set of questionSets) {
    const { count, points } = setSummary(list, set.key)
    if (count === 0) problems.push(`${set.label} 평가표에 문항이 없습니다. 문항 편집에서 넣어 주세요.`)
    else if (points !== 100) problems.push(`${set.label} 평가표 배점 합계가 ${points}점입니다. (100점이어야 함)`)
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
  if (!round || (round.status !== "준비 중" && round.status !== "평가 중")) return ENDED
  if (state.source === "server") {
    if (round.status === "준비 중") return serverSave(() => saveCycleSettings(roundNo, values))
    if (!values.deadline) return "평가 중에는 마감일을 비울 수 없습니다."
    const deadline = values.deadline
    return serverSave(() => updateDeadline(roundNo, deadline))
  }
  changeRound(roundNo, (item) =>
    item.status === "준비 중" ? { ...item, ...values } : { ...item, deadline: values.deadline },
  )
  return null
}

// ---------- 문항 (평가 전에만 바꿀 수 있다) ----------

export type QuestionValues = Pick<Question, "field" | "factor" | "factorPoints" | "content" | "type">

const editable = () => currentRound(state).status === "준비 중"

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

// 구분(분야) 순서 바꾸기: field 묶음을 targetField 자리로 옮긴다 (안의 평정요소·문항 순서는 그대로)
export function withMovedField(list: Question[], set: QuestionSet, field: string, targetField: string) {
  if (field === targetField) return null
  const fields = groupQuestions(list, set)
  const from = fields.findIndex((item) => item.field === field)
  const to = fields.findIndex((item) => item.field === targetField)
  if (from < 0 || to < 0) return null
  const [moved] = fields.splice(from, 1)
  fields.splice(to, 0, moved)
  const ordered = fields.flatMap((item) => item.factors.flatMap((factor) => factor.questions))
  return withSetOrder(list, set, ordered)
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

// 구분 이름 바꾸기 (그 구분의 모든 문항). 이미 있는 구분 이름이면 그 구분으로 합친다. 같은 이름이면 null
export function withRenamedField(list: Question[], set: QuestionSet, from: string, to: string) {
  if (!to.trim() || from === to.trim()) return null
  const renamed = list.map((question) =>
    question.questionSet === set && question.field === from ? { ...question, field: to.trim() } : question,
  )
  return withSetOrder(renamed, set, flatten(renamed, set))
}

// 구분 삭제 (그 구분의 모든 문항)
export function withoutField(list: Question[], set: QuestionSet, field: string) {
  const kept = list.filter((question) => !(question.questionSet === set && question.field === field))
  return withSetOrder(kept, set, flatten(kept, set))
}

// 평가 내용 배점 바꾸기 (그 평가 내용의 모든 문항에 함께. 구분 배점 = 평가 내용 배점의 합)
export function withFactorPoints(list: Question[], set: QuestionSet, field: string, factor: string, points: number) {
  return list.map((question) =>
    question.questionSet === set && question.field === field && question.factor === factor
      ? { ...question, factorPoints: points }
      : question,
  )
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
    const cycleId = state.cycleId
    if (cycleId === null) return NOT_SAVED
    return serverSave(() =>
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
  if (!round || round.status !== "준비 중" || startProblems(state, round).length) return NOT_STARTED
  if (state.source === "server") {
    const { startDate, deadline } = round
    if (!startDate || !deadline) return NOT_STARTED
    return serverSave(() => startCycle(roundNo, startDate, deadline))
  }
  changeRound(roundNo, (item) => ({ ...item, status: "평가 중" }))
  return null
}

// ---------- 평가 여러 개 (016) ----------

// 문항 편집 평가 탭: 이 평가의 문항을 보여 주고, 저장도 이 평가의 문항에만 한다
export function openRound(roundNo: number) {
  if (!state.rounds.some((round) => round.round === roundNo)) return
  questionRoundId = roundNo
  // 가짜 데이터는 문항이 한 벌이라 평가만 바꾼다 (잠금은 그 평가의 상태로)
  update({
    ...state,
    cycleId: roundNo,
    questions: state.source === "server" ? (state.roundQuestions[roundNo] ?? []) : state.questions,
  })
}

// 평가 추가: 고른 평가의 문항·비율·부서 KPI를 복사한 "준비 중" 평가 (평가 관계는 규칙대로 새로)
// sourceRound가 null이면 빈 평가 (문항 없음 · 반영 비율 기본값 · 부서 KPI 비움, 018)
export async function addRound(name: string, sourceRound: number | null): Promise<string | null> {
  if (!name.trim()) return "평가 이름을 입력해 주세요."
  if (state.source === "server")
    return serverSave(async () => {
      await newCycle(name.trim(), sourceRound)
    })
  const round = Math.max(0, ...state.rounds.map((item) => item.round)) + 1
  update({
    ...state,
    rounds: [
      { round, name: name.trim(), status: "준비 중", startDate: null, deadline: null, targetCount: null },
      ...state.rounds,
    ],
  })
  return null
}

// 평가 카드 삭제: 준비 중만 (docs/11). 확인 글자 "삭제"
export async function deleteRound(roundNo: number, confirmText: string): Promise<string | null> {
  const round = state.rounds.find((item) => item.round === roundNo)
  if (!round || round.status !== "준비 중") return "준비 중인 평가만 삭제할 수 있습니다."
  if (state.rounds.length <= 1) return "평가가 하나뿐이라 삭제할 수 없습니다."
  if (state.source === "server") return serverSave(() => deleteCycle(roundNo, confirmText))
  update({ ...state, rounds: state.rounds.filter((item) => item.round !== roundNo) })
  return null
}
