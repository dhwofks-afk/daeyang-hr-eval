// 리포트(/admin/reports)와 내 평가 결과(/my/results)가 함께 쓰는 저장 자리 (docs/03-리포트.md).
// 처음 값은 src/data/reports.ts에서 복사한다. reports.ts는 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase 읽기·쓰기로 바꾼다.
import { useSyncExternalStore } from "react"
import { type ScoreResult, type StageKey } from "@/lib/scoring"
import {
  confirmedResults,
  publicScopeItems,
  reportSetting,
  type ConfirmedResult,
  type PublicScopeKey,
} from "@/data/reports"

export type ReportState = {
  resultPublished: boolean
  publishedAt: string | null
  publicScope: PublicScopeKey[] // 공개 후에는 바꿀 수 없다
  confirmed: ConfirmedResult[] // 공개 취소해도 지우지 않는다
}

let state: ReportState = {
  resultPublished: reportSetting.resultPublished,
  publishedAt: reportSetting.publishedAt,
  publicScope: [...reportSetting.publicScope],
  confirmed: [...confirmedResults],
}

const listeners = new Set<() => void>()

function update(next: ReportState) {
  state = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useReportState = () =>
  useSyncExternalStore(subscribe, () => state)

// 공개 시각 (예: 2026-11-04T14:00:05)
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

// 화면 표시용 공개 시각 (예: 11/4 14:00)
export function publishedAtLabel(publishedAt: string) {
  const [date, time] = publishedAt.split("T")
  const [, month, day] = date.split("-")
  return `${Number(month)}/${Number(day)} ${time.slice(0, 5)}`
}

// ---------- 저장 (공개 상태가 맞지 않으면 false를 돌려주고 바꾸지 않는다) ----------

// 공개 범위: 공개 전에만 바꿀 수 있다. 준비 중 항목은 넣지 않는다
export function savePublicScope(scope: PublicScopeKey[]) {
  if (state.resultPublished) return false
  const ready = publicScopeItems
    .filter((item) => item.ready && scope.includes(item.key))
    .map((item) => item.key)
  update({ ...state, publicScope: ready })
  return true
}

// 결과 공개: 그 순간의 계산 결과를 확정 결과로 저장한다 (다시 공개하면 새 값으로 덮어쓴다)
export function publishResults(results: ScoreResult[]) {
  if (state.resultPublished || results.length === 0) return false
  update({
    ...state,
    resultPublished: true,
    publishedAt: nowText(),
    confirmed: results.map((result) => ({
      employeeNo: result.employeeNo,
      department: result.department,
      stages: { ...result.stages },
      weighted: result.weighted,
      kpiApplied: result.kpiApplied,
      final: result.final,
      grade: result.grade,
    })),
  })
  return true
}

// 공개 취소: 직원 화면은 다시 "준비 중". 확정 결과는 남긴다
export function unpublishResults() {
  if (!state.resultPublished) return false
  update({ ...state, resultPublished: false, publishedAt: null })
  return true
}

// ---------- 직원 화면에 보일 항목 ----------

// 단계 이름 (상향은 따로 보여 준다)
const stageLabels: { key: Exclude<StageKey, "upward">; label: string }[] = [
  { key: "self", label: "자기평가" },
  { key: "leader", label: "팀장 평가" },
  { key: "executive", label: "임원 평가" },
]

export type VisibleResult = {
  final: number | null
  grade: string | null
  stages: { label: string; score: number | null }[] | null // 미제출 단계는 score가 null
  upward: number | null | undefined // undefined면 보이지 않음, null이면 미제출
}

// 공개 범위에 체크된 항목만 남긴다. 상향 평가는 팀장에게만.
// 팀원은 팀장 평가까지 3단계, 팀장은 자기·임원 2단계를 보여 준다.
export function visibleResult(
  result: Pick<ConfirmedResult, "stages" | "final" | "grade">,
  isLeader: boolean,
  scope: PublicScopeKey[],
): VisibleResult {
  const has = (key: PublicScopeKey) => scope.includes(key)
  return {
    final: has("final") ? result.final : null,
    grade: has("grade") ? result.grade : null,
    stages: has("stages")
      ? stageLabels
          .filter((stage) => !(isLeader && stage.key === "leader"))
          .map((stage) => ({ label: stage.label, score: result.stages[stage.key] }))
      : null,
    upward: isLeader && has("upward") ? result.stages.upward : undefined,
  }
}
