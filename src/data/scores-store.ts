// 점수·보정 세 페이지(평가 결과 · KPI 반영 · 최종 점수 보정)가 함께 쓰는 저장 자리 (docs/02-점수보정.md).
// 처음 값은 src/data/scores.ts에서 복사한다. scores.ts는 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase 읽기·쓰기로 바꾼다.
// 점수는 저장하지 않고 scoring.ts로 그때그때 계산한다.
import { useSyncExternalStore } from "react"
import {
  computeResults,
  isValidMix,
  isValidWeights as weightsAddUp,
  type AdjustmentRecord,
  type MixRatio,
  type ScoreResult,
  type Weights,
} from "@/lib/scoring"
import { people } from "@/data/people"
import {
  adjustmentLog,
  departments,
  evaluationSetting,
  stageFieldScores,
} from "@/data/scores"

export type ScoreState = {
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

let state: ScoreState = {
  weights: {
    member: { ...evaluationSetting.weights.member },
    leader: { ...evaluationSetting.weights.leader },
  },
  mix: {
    member: { ...evaluationSetting.mix.member },
    leader: { ...evaluationSetting.mix.leader },
  },
  departmentKpi: Object.fromEntries(
    departments.map((department) => [department.name, department.kpi]),
  ),
  adjustments: [...adjustmentLog],
  resultPublished: evaluationSetting.resultPublished,
}

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

export const departmentNames = departments.map((department) => department.name)

// 사원번호 → 직원 (이름·직급은 화면 표시용)
export const personByNo = new Map(
  people.map((person) => [person.employeeNo, person]),
)

// 저장 자리의 값(또는 저장 전 입력값)으로 전체 결과를 계산한다.
export function scoreResults(
  values: Pick<
    ScoreState,
    "weights" | "mix" | "departmentKpi" | "adjustments"
  >,
) {
  return computeResults({
    people,
    stageFieldScores,
    departments: departmentNames.map((name) => ({
      name,
      kpi: values.departmentKpi[name],
    })),
    weights: values.weights,
    mix: values.mix,
    adjustments: values.adjustments,
  })
}

// 부서 선택 + 이름 검색으로 거르고, 정렬 기준대로 줄 세운다. (같으면 최종 점수 높은 순)
export function filterAndSort(
  results: ScoreResult[],
  { department, search, sort }: { department: string; search: string; sort: SortKey },
) {
  const nameOf = (result: ScoreResult) => personByNo.get(result.employeeNo)?.name ?? ""
  const keyword = search.trim()
  const byFinal = (a: ScoreResult, b: ScoreResult) => b.final - a.final
  const compare: Record<SortKey, (a: ScoreResult, b: ScoreResult) => number> = {
    department: (a, b) =>
      departmentNames.indexOf(a.department) - departmentNames.indexOf(b.department) ||
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

// ---------- 저장 (결과 확정 후에는 false를 돌려주고 바꾸지 않는다) ----------

// 비율 검사: 모든 칸 0~100, 개인 평가 단계 합 100(팀원·팀장 따로), 최종 점수 비율 합 100(팀원·팀장 따로)
const inRange = (values: number[]) =>
  values.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)

export const isValidWeights = (weights: Weights) =>
  inRange([...Object.values(weights.member), ...Object.values(weights.leader)]) && weightsAddUp(weights)

export const isValidMixRatio = (mix: MixRatio) =>
  inRange([...Object.values(mix.member), ...Object.values(mix.leader)]) && isValidMix(mix)

export function saveRatios(weights: Weights, mix: MixRatio) {
  if (state.resultPublished || !isValidWeights(weights) || !isValidMixRatio(mix)) return false
  update({
    ...state,
    weights: { member: { ...weights.member }, leader: { ...weights.leader } },
    mix: { member: { ...mix.member }, leader: { ...mix.leader } },
  })
  return true
}

export function saveKpi(departmentKpi: Record<string, number>) {
  if (state.resultPublished) return false
  update({ ...state, departmentKpi: { ...departmentKpi } })
  return true
}

// 보정 기록에 새 줄을 쌓는다. after가 null이면 보정 취소.
export function addAdjustments(
  records: { employeeNo: string; before: number; after: number | null; reason: string }[],
) {
  if (state.resultPublished) return false
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
  return true
}
