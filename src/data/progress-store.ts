// 진행 관리 두 페이지(응답 현황 · 반려 현황)가 함께 쓰는 저장 자리 (docs/08-진행관리.md).
// - 가짜 데이터: 처음 값은 dashboard.ts(평가 건)와 progress.ts(반려 기록)에서 복사한다. 두 파일은 읽기만 한다.
//   화면 메모리에만 있어 새로고침하면 처음 값으로 돌아간다.
// - 저장소: 실제 관리자 로그인으로 진행 관리·대시보드 페이지를 열면 따로 두는 칸(server)에 읽어 온다 (src/lib/admin-data.ts).
// 대시보드도 progressView로 같은 칸을 읽어, 진행 관리에서 반려하면 대시보드 숫자도 바뀐다.
import { useEffect, useSyncExternalStore } from "react"
import { evaluationCases, type EvaluationCase } from "@/data/dashboard"
import { findPerson as findFakePerson, people as fakePeople, type Person } from "@/data/people"
import { returnLogs, type ReturnLog } from "@/data/progress"
import { departments as fakeDepartments, evaluationSetting } from "@/data/scores"
import {
  isAdminSession,
  loadCurrentCycle,
  loadDepartments,
  loadPeople,
  loadProgress,
  returnCase as serverReturnCase,
  type AdminCycle,
} from "@/lib/admin-data"

// 저장소에서 읽은 진행 상황 (진행 관리·대시보드가 쓴다)
export type ServerProgress = {
  cases: EvaluationCase[]
  returnLogs: ReturnLog[]
  people: Person[]
  departmentNames: string[]
  cycleName: string
  cycleStatus: AdminCycle["status"]
  deadline: string | null // 평가 마감일 (예: 2026-11-20). 미정이면 null
  resultPublished: boolean
}

export type ProgressState = {
  cases: EvaluationCase[] // 가짜 데이터
  returnLogs: ReturnLog[] // 가짜 데이터. 추가만 (지우거나 고치지 않음)
  // checking: 실제 관리자 로그인인지 확인 중 / loading: 저장소에서 읽는 중 / fake: 가짜 데이터 / server: 저장소
  source: "checking" | "loading" | "fake" | "server" | "error"
  error: string | null
  server: ServerProgress | null
}

let state: ProgressState = {
  cases: [...evaluationCases],
  returnLogs: [...returnLogs],
  source: "checking",
  error: null,
  server: null,
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

// ---------- 저장소 연결 ----------

const messageOf = (caught: unknown) => (caught instanceof Error ? caught.message : String(caught))

async function reloadServer() {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("회차가 없습니다.")
  const [people, departments] = await Promise.all([loadPeople(), loadDepartments()])
  const progress = await loadProgress(cycle.id, people)
  update({
    ...state,
    source: "server",
    error: null,
    server: {
      cases: progress.cases,
      returnLogs: progress.returnLogs,
      people,
      departmentNames: departments.map((department) => department.name),
      cycleName: cycle.name,
      cycleStatus: cycle.status,
      deadline: cycle.deadline,
      resultPublished: cycle.resultPublished,
    },
  })
}

// 진행 관리 페이지를 열 때마다 확인한다: 실제 관리자면 저장소에서 읽고, 아니면 가짜 데이터
async function connect() {
  if (!(await isAdminSession())) {
    if (state.source !== "fake") update({ ...state, source: "fake", error: null, server: null })
    return
  }
  if (state.source !== "server") update({ ...state, source: "loading" })
  try {
    await reloadServer()
  } catch (caught) {
    update({ ...state, source: "error", error: messageOf(caught) })
  }
}

// 응답 현황·반려 현황·대시보드 페이지가 열릴 때 부른다
export function useProgressConnection() {
  useEffect(() => {
    void connect()
  }, [])
}

// 진행 관리·대시보드가 보여 줄 값: 저장소면 따로 둔 칸, 아니면 가짜 칸
export function progressView(current: ProgressState) {
  const server = current.source === "server" ? current.server : null
  if (server) {
    const byNo = new Map(server.people.map((person) => [person.employeeNo, person]))
    return {
      ready: true,
      cases: server.cases,
      returnLogs: server.returnLogs,
      findPerson: (employeeNo: string) => byNo.get(employeeNo),
      people: server.people,
      departmentNames: server.departmentNames,
    }
  }
  return {
    ready: current.source === "fake",
    cases: current.cases,
    returnLogs: current.returnLogs,
    findPerson: findFakePerson,
    people: fakePeople,
    departmentNames: fakeDepartments.map((department) => department.name),
  }
}

// ---------- 반려 ----------

// 반려를 지금 할 수 없는 이유 (할 수 있으면 null). 문구는 서버 함수 return_case의 오류 문구와 같다.
// 저장소면 그 회차의 상태·결과 확정, 가짜 데이터면 평가 설정과 scores-store의 결과 공개 여부(화면이 넘긴다)
export function returnBlockedReason(resultPublished: boolean) {
  const server = state.source === "server" ? state.server : null
  const inProgress = server ? server.cycleStatus === "in_progress" : evaluationSetting.status === "평가 중"
  const published = server ? server.resultPublished : resultPublished
  if (!inProgress) return "평가 중일 때만 반려할 수 있습니다."
  if (published) return "결과가 공개된 뒤에는 반려할 수 없습니다."
  return null
}

// 처리 시각 (예: 2026-11-03T14:20:05)
function nowText() {
  const now = new Date()
  const two = (value: number) => String(value).padStart(2, "0")
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}T${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`
}

type ReturnResult = { ok: true } | { ok: false; message: string }

// 반려: return_case와 같은 순서로 확인한 뒤 상태 "반려" + 반려 기록 한 줄을 한 번에 바꾼다.
// 저장소면 서버 함수를 부르고 다시 읽는다. 실패하면 서버와 같은 문구를 돌려준다.
export async function returnCase(caseId: number, reason: string, resultPublished: boolean): Promise<ReturnResult> {
  const trimmed = reason.trim()
  if (!trimmed) return { ok: false, message: "반려 사유를 입력해 주세요." }
  const view = progressView(state)
  const item = view.cases.find((other) => other.id === caseId)
  if (!item) return { ok: false, message: "평가 건을 찾을 수 없습니다." }
  const blocked = returnBlockedReason(resultPublished)
  if (blocked) return { ok: false, message: blocked }
  if (item.status !== "submitted") return { ok: false, message: "제출된 평가만 반려할 수 있습니다." }

  if (state.source === "server") {
    try {
      await serverReturnCase(caseId, trimmed)
      await reloadServer()
      return { ok: true }
    } catch (caught) {
      const message = messageOf(caught)
      try {
        await reloadServer()
      } catch {
        // 다시 읽기도 실패하면 화면은 그대로 둔다
      }
      return { ok: false, message }
    }
  }

  const nextId = Math.max(0, ...state.returnLogs.map((log) => log.id)) + 1
  update({
    ...state,
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
