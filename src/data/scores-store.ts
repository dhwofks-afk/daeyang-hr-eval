// 점수·보정 세 페이지(평가 결과 · KPI 반영 · 최종 점수 보정)가 함께 쓰는 저장 자리 (docs/02-점수보정.md).
// 관리자로 실제 로그인했으면 저장소(src/lib/admin-data.ts)에서 읽고 저장한다. 저장하면 저장소에서 다시 읽는다.
// 역할 미리보기면 처음 값을 src/data/scores.ts에서 복사해 화면 메모리에만 둔다 (새로고침하면 처음 값). scores.ts는 읽기만 한다.
// 점수는 저장하지 않고 scoring.ts로 그때그때 계산한다.
import { useEffect, useSyncExternalStore } from "react"
import {
  computeResults,
  isValidMix,
  isValidWeights as weightsAddUp,
  type AdjustmentRecord,
  type MixRatio,
  type ScoreInput,
  type ScoreResult,
  type StageFieldScores,
  type Weights,
} from "@/lib/scoring"
import {
  insertAdjustments,
  isAdminSession,
  loadCurrentCycle,
  loadScoreData,
  saveCycleRatios,
  saveDepartmentKpi,
} from "@/lib/admin-data"
import { people, type Person } from "@/data/people"
import {
  adjustmentLog,
  departments,
  evaluationSetting,
  stageFieldScores,
} from "@/data/scores"

// 점수 계산에 쓰는 사람 (저장소 직원은 평가 제외·재직 상태와 내부 번호도 있다)
export type ScorePerson = Person & { id?: number; excluded?: boolean; status?: "active" | "retired" }

export type ScoreState = {
  // checking: 실제 관리자 로그인인지 확인 중 / loading: 저장소에서 읽는 중 / fake: 가짜 데이터 / server: 저장소
  source: "checking" | "loading" | "fake" | "server" | "error"
  error: string | null
  cycleId: number
  cycleName: string
  cycleStatus: string // 평가 전 / 평가 중 / 평가 완료
  people: ScorePerson[]
  personByNo: Map<string, ScorePerson> // 사원번호 → 직원 (이름·직급은 화면 표시용)
  departments: { id: number; name: string }[]
  departmentNames: string[]
  stageFieldScores: Record<string, StageFieldScores>
  weights: Weights // 개인 평가의 단계별 비율. 평가 결과 페이지에서 수정한다
  mix: MixRatio // 최종 점수 비율 (개인·부서 KPI·상향). 평가 결과 페이지에서 수정한다
  departmentKpi: Record<string, number> // 부서명 → KPI 점수
  adjustments: AdjustmentRecord[] // 새 줄 추가만 (지우거나 고치지 않음)
  resultPublished: boolean // 결과 확정 후에는 비율·KPI·보정을 바꿀 수 없다
}

// 두 표(평가 결과·보정)의 정렬 기준
export type SortKey = "department" | "final" | "name"

export const sortOptions: { key: SortKey; label: string }[] = [
  { key: "department", label: "부서·순위" },
  { key: "final", label: "최종 점수" },
  { key: "name", label: "이름" },
]

// 가짜 데이터의 부서 목록·직원 (리포트의 역할 미리보기도 쓴다)
export const departmentNames = departments.map((department) => department.name)

export const personByNo = new Map<string, ScorePerson>(
  people.map((person) => [person.employeeNo, person]),
)

const fakeState = (): ScoreState => ({
  source: "fake",
  error: null,
  cycleId: evaluationSetting.round,
  cycleName: evaluationSetting.name,
  cycleStatus: evaluationSetting.status,
  people,
  personByNo,
  departments: departments.map(({ id, name }) => ({ id, name })),
  departmentNames,
  stageFieldScores,
  weights: {
    member: { ...evaluationSetting.weights.member },
    leader: { ...evaluationSetting.weights.leader },
  },
  mix: {
    member: { ...evaluationSetting.mix.member },
    leader: { ...evaluationSetting.mix.leader },
    executive: { ...evaluationSetting.mix.executive },
    execUpward: { ...evaluationSetting.mix.execUpward },
  },
  departmentKpi: Object.fromEntries(
    departments.map((department) => [department.name, department.kpi]),
  ),
  adjustments: [...adjustmentLog],
  resultPublished: evaluationSetting.resultPublished,
})

let state: ScoreState = { ...fakeState(), source: "checking" }

const listeners = new Set<() => void>()

function update(next: ScoreState) {
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
export const useScoreState = () =>
  useSyncExternalStore(subscribe, () => state)

// ---------- 저장소 연결 ----------

const statusLabels = { before: "평가 전", in_progress: "평가 중", done: "평가 완료" } as const

async function reloadServer() {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("회차가 없습니다.")
  const data = await loadScoreData(cycle)
  update({
    source: "server",
    error: null,
    cycleId: cycle.id,
    cycleName: cycle.name,
    cycleStatus: statusLabels[cycle.status],
    people: data.people,
    personByNo: new Map(data.people.map((person) => [person.employeeNo, person])),
    departments: data.departments.map(({ id, name }) => ({ id, name })),
    departmentNames: data.departments.map((department) => department.name),
    stageFieldScores: data.input.stageFieldScores,
    weights: cycle.weights,
    mix: cycle.mix,
    // KPI가 아직 없는 부서는 0점 (scoring.ts와 같은 규칙)
    departmentKpi: Object.fromEntries(data.departments.map((department) => [department.name, department.kpi ?? 0])),
    adjustments: data.input.adjustments,
    resultPublished: cycle.resultPublished,
  })
}

// 페이지를 열 때마다 확인한다: 실제 관리자면 저장소에서 읽고, 아니면 가짜 데이터 (로그아웃 후 역할 미리보기 포함)
async function connect() {
  const isAdmin = await isAdminSession()
  if (!isAdmin) {
    if (state.source !== "fake") update(fakeState())
    return
  }
  if (state.source !== "server") update({ ...state, source: "loading" })
  try {
    await reloadServer()
  } catch (caught) {
    update({ ...state, source: "error", error: caught instanceof Error ? caught.message : String(caught) })
  }
}

// 점수·보정 페이지가 열릴 때 부른다
export function useScoreConnection() {
  useEffect(() => {
    void connect()
  }, [])
}

// ---------- 계산 ----------

// 저장 자리의 값(또는 저장 전 입력값)으로 전체 결과를 계산한다.
// 사람·단계 점수·부서를 넘기지 않으면 가짜 데이터로 계산한다 (리포트의 역할 미리보기)
export function scoreResults(
  values: Pick<ScoreState, "weights" | "mix" | "departmentKpi" | "adjustments"> &
    Partial<Pick<ScoreState, "people" | "stageFieldScores" | "departmentNames">>,
) {
  const input: ScoreInput = {
    people: values.people ?? people,
    stageFieldScores: values.stageFieldScores ?? stageFieldScores,
    departments: (values.departmentNames ?? departmentNames).map((name) => ({
      name,
      kpi: values.departmentKpi[name] ?? 0,
    })),
    weights: values.weights,
    mix: values.mix,
    adjustments: values.adjustments,
  }
  return computeResults(input)
}

// 부서 선택 + 이름 검색으로 거르고, 정렬 기준대로 줄 세운다. (같으면 최종 점수 높은 순)
export function filterAndSort(
  results: ScoreResult[],
  { department, search, sort }: { department: string; search: string; sort: SortKey },
  names: Pick<ScoreState, "personByNo" | "departmentNames"> = { personByNo, departmentNames },
) {
  const nameOf = (result: ScoreResult) => names.personByNo.get(result.employeeNo)?.name ?? ""
  const keyword = search.trim()
  const byFinal = (a: ScoreResult, b: ScoreResult) => b.final - a.final
  const compare: Record<SortKey, (a: ScoreResult, b: ScoreResult) => number> = {
    department: (a, b) =>
      names.departmentNames.indexOf(a.department) - names.departmentNames.indexOf(b.department) ||
      byFinal(a, b),
    final: byFinal,
    name: (a, b) => nameOf(a).localeCompare(nameOf(b), "ko") || byFinal(a, b),
  }
  return results
    .filter((result) => department === "전체" || result.department === department)
    .filter((result) => !keyword || nameOf(result).includes(keyword))
    .sort(compare[sort])
}

// 보정 기록의 시각 (예: 2026-11-03T14:20:05). 같은 분에 여러 번 저장해도 순서가 맞게 초까지 적는다.
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

// ---------- 저장 (되면 null, 안 되면 화면에 보일 문구) ----------

const LOCKED = "결과가 확정되어 수정할 수 없습니다."
const NOT_SAVED = "저장하지 못했습니다. 화면을 새로 보고 다시 시도해 주세요."

// 저장소에 쓰고 다시 읽는다. 실패하면 저장소가 알려 준 이유를 붙인다
async function serverSave(write: () => Promise<void>) {
  try {
    await write()
    await reloadServer()
    return null
  } catch (caught) {
    return `${NOT_SAVED} (${caught instanceof Error ? caught.message : String(caught)})`
  }
}

// 비율 검사: 모든 칸 0~100, 개인 평가 단계 합 100(팀원·팀장 따로), 최종 점수 비율 합 100(팀원·팀장 따로)
const inRange = (values: number[]) =>
  values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)

export const isValidWeights = (weights: Weights) =>
  inRange([...Object.values(weights.member), ...Object.values(weights.leader)]) && weightsAddUp(weights)

export const isValidMixRatio = (mix: MixRatio) =>
  inRange([
    ...Object.values(mix.member),
    ...Object.values(mix.leader),
    ...Object.values(mix.executive),
    ...Object.values(mix.execUpward),
  ]) && isValidMix(mix)

export async function saveRatios(weights: Weights, mix: MixRatio): Promise<string | null> {
  if (state.resultPublished) return LOCKED
  if (!isValidWeights(weights) || !isValidMixRatio(mix)) return NOT_SAVED
  if (state.source === "server") return serverSave(() => saveCycleRatios(state.cycleId, weights, mix))
  update({
    ...state,
    weights: { member: { ...weights.member }, leader: { ...weights.leader } },
    mix: {
      member: { ...mix.member },
      leader: { ...mix.leader },
      executive: { ...mix.executive },
      execUpward: { ...mix.execUpward },
    },
  })
  return null
}

export async function saveKpi(departmentKpi: Record<string, number>): Promise<string | null> {
  if (state.resultPublished) return LOCKED
  if (state.source === "server") {
    const changes = state.departments
      .filter((department) => departmentKpi[department.name] !== state.departmentKpi[department.name])
      .map((department) => ({ id: department.id, kpi: departmentKpi[department.name] }))
    return serverSave(() => saveDepartmentKpi(changes))
  }
  update({ ...state, departmentKpi: { ...departmentKpi } })
  return null
}

// 보정 기록에 새 줄을 쌓는다. after가 null이면 보정 취소.
export async function addAdjustments(
  records: { employeeNo: string; before: number; after: number | null; reason: string }[],
): Promise<string | null> {
  if (state.resultPublished) return LOCKED
  if (state.source === "server") {
    const rows = records.flatMap((record) => {
      const id = state.personByNo.get(record.employeeNo)?.id
      return id === undefined ? [] : [{ ...record, employeeId: id }]
    })
    if (rows.length !== records.length) return NOT_SAVED
    return serverSave(() => insertAdjustments(state.cycleId, rows))
  }
  const adjustedAt = nowText()
  update({
    ...state,
    adjustments: [
      ...state.adjustments,
      ...records.map((record) => ({
        ...record,
        round: evaluationSetting.round,
        adjustedBy: "관리자",
        adjustedAt,
      })),
    ],
  })
  return null
}
