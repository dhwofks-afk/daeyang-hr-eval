// 진행 관리 두 페이지(응답 현황 · 제출 반려)가 함께 쓰는 저장 자리 (docs/08-진행관리.md).
// 처음 값은 dashboard.ts(평가 건)와 progress.ts(반려 기록)에서 복사한다. 두 파일은 읽기만 한다.
// 지금은 화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다. 11/4에 이 파일만 Supabase로 바꾼다
// (평가 건·반려 기록 읽기, 반려는 서버 함수 return_case).
import { useSyncExternalStore } from "react"
import { evaluationCases, type EvaluationCase } from "@/data/dashboard"
import { returnLogs, type ReturnLog } from "@/data/progress"
import { evaluationSetting } from "@/data/scores"

export type ProgressState = {
  cases: EvaluationCase[]
  returnLogs: ReturnLog[] // 추가만 (지우거나 고치지 않음)
}

let state: ProgressState = {
  cases: [...evaluationCases],
  returnLogs: [...returnLogs],
}

const listeners = new Set<() => void>()

function update(next: ProgressState) {
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
export const useProgressState = () =>
  useSyncExternalStore(subscribe, () => state)

// 반려를 지금 할 수 없는 이유 (할 수 있으면 null). 결과 공개 여부는 scores-store의 값을 화면이 넘긴다.
// 문구는 서버 함수 return_case의 오류 문구와 같다.
export function returnBlockedReason(resultPublished: boolean) {
  if (evaluationSetting.status !== "평가 중") return "평가 중일 때만 반려할 수 있습니다."
  if (resultPublished) return "결과가 공개된 뒤에는 반려할 수 없습니다."
  return null
}

// 처리 시각 (예: 2026-11-03T14:20:05)
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

// 반려: return_case와 같은 순서로 확인한 뒤 상태 "반려" + 반려 기록 한 줄을 한 번에 바꾼다.
// 실패하면 서버와 같은 문구를 돌려준다.
export function returnCase(
  caseId: number,
  reason: string,
  resultPublished: boolean,
): { ok: true } | { ok: false; message: string } {
  const trimmed = reason.trim()
  if (!trimmed) return { ok: false, message: "반려 사유를 입력해 주세요." }
  const item = state.cases.find((other) => other.id === caseId)
  if (!item) return { ok: false, message: "평가 건을 찾을 수 없습니다." }
  const blocked = returnBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (item.status !== "submitted") return { ok: false, message: "제출된 평가만 반려할 수 있습니다." }

  const nextId = Math.max(0, ...state.returnLogs.map((log) => log.id)) + 1
  update({
    cases: state.cases.map((other) =>
      other.id === caseId ? { ...other, status: "returned" } : other,
    ),
    returnLogs: [
      ...state.returnLogs,
      { id: nextId, caseId, reason: trimmed, returnedBy: "관리자", returnedAt: nowText() },
    ],
  })
  return { ok: true }
}
