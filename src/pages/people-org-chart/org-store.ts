// 조직도 저장 자리 (docs/13-조직도.md 4번)
// - 실제 관리자 로그인: 저장소(Supabase)에서 직원·부서·직급·평가 중 여부를 읽고, 직원을 고친다 (src/lib/admin-data.ts)
// - 역할 미리보기: 가짜 데이터. 처음 값은 src/data/people.ts에서 복사하고(people.ts는 읽기만 한다),
//   고친 내용은 화면 메모리에만 있어 새로고침하면 처음으로 돌아간다
import { useEffect, useSyncExternalStore } from "react"
import { headquarterOf, people, positions, type PersonRole } from "@/data/people"
import { departments as fakeDepartments } from "@/data/scores"
import {
  isAdminSession,
  loadCurrentCycle,
  loadDepartments,
  loadPeople,
  loadPositions,
  saveEmployee,
  saveEmployeeStatus,
} from "@/lib/admin-data"

export type JobGroup = "production" | "office"

export type OrgPerson = {
  id?: number // 저장소 내부 번호 (가짜 데이터면 없음)
  employeeNo: string
  name: string
  department: string
  position: string
  role: PersonRole
  jobGroup: JobGroup
  excluded: boolean
  status: "active" | "retired"
  headquarters?: string | null // 본부 (임원만, 014). 조직도는 보여 주기만 하고, 바꾸는 것은 명단 올리기
}

export type OrgState = {
  // checking: 실제 관리자 로그인인지 확인 중 / loading: 저장소에서 읽는 중 / fake: 가짜 데이터 / server: 저장소
  source: "checking" | "loading" | "fake" | "server" | "error"
  error: string | null
  people: OrgPerson[]
  departments: { id: number | null; name: string; headquarters: string | null }[] // 부서 (가짜 데이터면 번호 없음) · 본부
  positionNames: string[] // 직급: 낮은 직급 → 높은 직급
  // 저장소: 지금 회차가 평가 중인지. 가짜 데이터는 평가 설계(가짜) 회차 상태를 화면이 넘긴다
  evaluationInProgress: boolean
}

// 가짜 데이터의 부서 (src/data/scores.ts 부서 6개, 번호 순)
export const departmentNames = fakeDepartments.map((department) => department.name)

// 가짜 데이터의 직급 순서: 낮은 직급 → 높은 직급 (people.ts 목록 그대로)
export const positionNames = positions

// 처음 값: people.ts에 없는 칸은 seed(02_employees.sql)와 같은 규칙으로 채운다
// 직군: 생산 부서면 생산직, 나머지는 관리직 / 평가 제외: 없음 (임원도 평가 대상, 11/3) / 재직 상태: 모두 재직
const fakeState = (): OrgState => ({
  source: "fake",
  error: null,
  people: people.map((person) => ({
    ...person,
    jobGroup: person.department === "생산부" ? "production" : "office",
    excluded: false,
    status: "active",
  })),
  departments: departmentNames.map((name) => ({ id: null, name, headquarters: headquarterOf(name) })),
  positionNames,
  evaluationInProgress: false,
})

let state: OrgState = { ...fakeState(), source: "checking" }

const listeners = new Set<() => void>()

function update(next: OrgState) {
  state = next
  for (const listener of listeners) listener()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export const useOrgState = () => useSyncExternalStore(subscribe, () => state)

// ---------- 저장소 연결 ----------

const messageOf = (caught: unknown) => (caught instanceof Error ? caught.message : String(caught))

async function reloadServer() {
  const [cycle, list, departments, positionList] = await Promise.all([
    loadCurrentCycle(),
    loadPeople(),
    loadDepartments(),
    loadPositions(),
  ])
  // 직급 목록에 없는 직급을 가진 사람이 있으면 맨 아래(낮은 직급)에 붙여 둔다 (카드가 사라지지 않게)
  const extra = [...new Set(list.map((person) => person.position))].filter((name) => !positionList.includes(name))
  update({
    source: "server",
    error: null,
    people: list.map((person) => ({ ...person })),
    departments: departments.map(({ id, name, headquarters }) => ({ id, name, headquarters })),
    positionNames: [...extra, ...positionList],
    evaluationInProgress: cycle?.status === "in_progress",
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

// 조직도 페이지가 열릴 때 부른다
export function useOrgConnection() {
  useEffect(() => {
    void connect()
  }, [])
}

// ---------- 저장 ----------

export type OrgChange = Pick<OrgPerson, "department" | "position" | "role" | "jobGroup" | "excluded" | "status">

export type SaveResult = { saved: boolean; relationChanged: boolean; problem: string | null }

const LOCKED = "평가 중에는 조직도를 고칠 수 없습니다 (퇴사 처리만 가능)."

// 한 사람 고치기. 평가 중(locked)이면 재직 상태(퇴사 처리·되돌리기)만 바꿀 수 있다 (11/3).
// relationChanged: 평가 관계에 영향이 있는 변경인지 (부서·역할·평가 제외·재직 상태)
// 저장소면 저장이 끝날 때까지 기다리고, 끝나면 다시 읽는다. 실패하면 problem에 이유
export async function savePerson(employeeNo: string, change: OrgChange, locked: boolean): Promise<SaveResult> {
  const before = state.people.find((person) => person.employeeNo === employeeNo)
  if (!before) return { saved: false, relationChanged: false, problem: "직원을 찾을 수 없습니다." }
  const onlyStatus =
    before.department === change.department &&
    before.position === change.position &&
    before.role === change.role &&
    before.jobGroup === change.jobGroup &&
    before.excluded === change.excluded
  if (locked && !onlyStatus) return { saved: false, relationChanged: false, problem: LOCKED }
  const relationChanged =
    before.department !== change.department ||
    before.role !== change.role ||
    before.excluded !== change.excluded ||
    before.status !== change.status

  if (state.source === "server") {
    const departmentId = state.departments.find((item) => item.name === change.department)?.id
    if (before.id === undefined || departmentId === undefined || departmentId === null) {
      return { saved: false, relationChanged: false, problem: "저장하지 못했습니다. (부서를 찾을 수 없습니다)" }
    }
    try {
      // 재직 상태만 바뀌면 그 칸만 쓴다 (평가 중에도 허용되는 칸)
      if (onlyStatus) await saveEmployeeStatus(before.id, change.status)
      else await saveEmployee(before.id, { ...change, departmentId })
      await reloadServer()
      return { saved: true, relationChanged, problem: null }
    } catch (caught) {
      const reason = messageOf(caught)
      try {
        await reloadServer()
      } catch {
        // 다시 읽기도 실패하면 화면은 그대로 둔다
      }
      return { saved: false, relationChanged: false, problem: `저장하지 못했습니다. (${reason})` }
    }
  }

  update({
    ...state,
    people: state.people.map((person) =>
      person.employeeNo === employeeNo ? { ...person, ...change } : person,
    ),
  })
  return { saved: true, relationChanged, problem: null }
}
