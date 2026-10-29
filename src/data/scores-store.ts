// 점수·보정 세 페이지(평가 결과 · KPI 반영 · 최종 점수 보정)가 함께 쓰는 저장 자리 (docs/02-점수보정.md).
// 처음 값은 src/data/scores.ts에서 복사한다. scores.ts는 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase 읽기·쓰기로 바꾼다.
// 점수·등급은 저장하지 않고 scoring.ts로 그때그때 계산한다.
import { useSyncExternalStore } from "react"
import {
  computeResults,
  isValidGradeRatio,
  type AdjustmentRecord,
  type GradeRatio,
  type KpiSetting,
} from "@/lib/scoring"
import { people } from "@/data/people"
import {
  adjustmentLog,
  departments,
  evaluationSetting,
  stageFieldScores,
} from "@/data/scores"

export type ScoreState = {
  kpi: KpiSetting
  departmentKpi: Record<string, number> // 부서명 → KPI 점수
  gradeRatio: GradeRatio
  adjustments: AdjustmentRecord[] // 새 줄 추가만 (지우거나 고치지 않음)
  resultPublished: boolean // 결과 공개 후에는 KPI·보정·등급 비율을 바꿀 수 없다
}

let state: ScoreState = {
  kpi: { ...evaluationSetting.kpi },
  departmentKpi: Object.fromEntries(
    departments.map((department) => [department.name, department.kpi]),
  ),
  gradeRatio: { ...evaluationSetting.gradeRatio },
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
  values: Pick<ScoreState, "kpi" | "departmentKpi" | "gradeRatio" | "adjustments">,
) {
  return computeResults({
    people,
    stageFieldScores,
    departments: departmentNames.map((name) => ({
      name,
      kpi: values.departmentKpi[name],
    })),
    weights: evaluationSetting.weights,
    kpi: values.kpi,
    gradeRatio: values.gradeRatio,
    adjustments: values.adjustments,
  })
}

// 보정 기록의 시각 (예: 2026-11-03T14:20:05). 같은 분에 여러 번 저장해도 순서가 맞게 초까지 적는다.
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

// ---------- 저장 (결과 공개 후에는 false를 돌려주고 바꾸지 않는다) ----------

export function saveKpi(kpi: KpiSetting, departmentKpi: Record<string, number>) {
  if (state.resultPublished) return false
  update({ ...state, kpi: { ...kpi }, departmentKpi: { ...departmentKpi } })
  return true
}

export function saveGradeRatio(ratio: GradeRatio) {
  if (state.resultPublished || !isValidGradeRatio(ratio)) return false
  update({ ...state, gradeRatio: { ...ratio } })
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
