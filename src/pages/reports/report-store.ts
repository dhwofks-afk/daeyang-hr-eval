// 리포트(/admin/reports)의 저장 자리 (docs/03-리포트.md). 결과는 관리자만 본다.
// 처음 값은 src/data/reports.ts에서 복사한다. reports.ts는 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase 읽기·쓰기로 바꾼다.
import { useSyncExternalStore } from "react"
import { type ScoreResult, type StageKey } from "@/lib/scoring"
import { confirmedResults, reportSetting, type ConfirmedResult } from "@/data/reports"

export type ReportState = {
  resultPublished: boolean // 결과 확정
  publishedAt: string | null // 확정 시각
  confirmed: ConfirmedResult[] // 확정 취소해도 지우지 않는다
}

let state: ReportState = {
  resultPublished: reportSetting.resultPublished,
  publishedAt: reportSetting.publishedAt,
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

// 확정 시각 (예: 2026-11-04T14:00:05)
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

// 화면 표시용 확정 시각 (예: 11/4 14:00)
export function publishedAtLabel(publishedAt: string) {
  const [date, time] = publishedAt.split("T")
  const [, month, day] = date.split("-")
  return `${Number(month)}/${Number(day)} ${time.slice(0, 5)}`
}

// ---------- 저장 (확정 상태가 맞지 않으면 false를 돌려주고 바꾸지 않는다) ----------

// 결과 확정: 그 순간의 계산 결과를 확정 결과로 저장하고 잠근다 (다시 확정하면 새 값으로 덮어쓴다)
export function confirmResults(results: ScoreResult[]) {
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
    })),
  })
  return true
}

// 확정 취소: 잠금을 푼다. 확정 결과는 남긴다
export function cancelConfirm() {
  if (!state.resultPublished) return false
  update({ ...state, resultPublished: false, publishedAt: null })
  return true
}

// ---------- 개인 리포트에 보일 항목 (관리자 전용) ----------

// 단계 이름 (상향은 따로 보여 준다)
const stageLabels: { key: Exclude<StageKey, "upward">; label: string }[] = [
  { key: "self", label: "자기평가" },
  { key: "leader", label: "팀장 평가" },
  { key: "executive", label: "임원 평가" },
  { key: "exec_upward", label: "임원 상향 평가" },
]

export type VisibleResult = {
  final: number
  stages: { label: string; score: number | null }[] // 미제출 단계는 score가 null
  upward: number | null | undefined // 팀원이면 undefined, null이면 미제출
}

// 팀원은 자기·팀장·임원 3단계, 팀장은 자기·임원 2단계 + 상향 평가, 임원은 임원 상향 평가
export function visibleResult(
  result: Pick<ConfirmedResult, "stages" | "final">,
  isLeader: boolean,
  isExecutive = false,
): VisibleResult {
  return {
    final: result.final,
    stages: stageLabels
      .filter((stage) =>
        isExecutive
          ? stage.key === "exec_upward"
          : stage.key !== "exec_upward" && !(isLeader && stage.key === "leader"),
      )
      .map((stage) => ({ label: stage.label, score: result.stages[stage.key] })),
    upward: isLeader ? result.stages.upward : undefined,
  }
}
