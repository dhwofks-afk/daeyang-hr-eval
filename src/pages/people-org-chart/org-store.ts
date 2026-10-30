// 조직도 저장 자리 (docs/13-조직도.md 4번, 가짜 데이터 단계)
// 처음 값은 src/data/people.ts에서 복사한다. people.ts는 읽기만 한다.
// 고친 내용은 화면 메모리에만 있어 새로고침하면 처음으로 돌아간다. 실제 연결 때 이 파일만 Supabase 읽기·쓰기로 바꾼다.
import { useSyncExternalStore } from "react"
import { people, positions, type PersonRole } from "@/data/people"

export type JobGroup = "production" | "office"

export type OrgPerson = {
  employeeNo: string
  name: string
  department: string
  position: string
  role: PersonRole
  jobGroup: JobGroup
  excluded: boolean
  status: "active" | "retired"
}

export type OrgState = {
  people: OrgPerson[]
  // 평가 중이면 조직도를 고칠 수 없다. 지금 DB(시연 초기화 후 "평가 전")와 같게 처음 값은 false
  evaluationInProgress: boolean
}

// 실제 부서 (임원의 "임원"은 부서가 아니라서 뺀다)
export const departmentNames = [
  ...new Set(people.filter((person) => person.role !== "executive").map((person) => person.department)),
]

// 직급 순서: 낮은 직급 → 높은 직급 (people.ts 목록 그대로)
export const positionNames = positions

// 처음 값: people.ts에 없는 칸은 seed(02_employees.sql)와 같은 규칙으로 채운다
// 직군: 생산 부서면 생산직, 나머지는 관리직 / 평가 제외: 임원만 / 재직 상태: 모두 재직
let state: OrgState = {
  people: people.map((person) => ({
    ...person,
    jobGroup: person.department === "생산" ? "production" : "office",
    excluded: person.role === "executive",
    status: "active",
  })),
  evaluationInProgress: false,
}

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

export type OrgChange = Pick<OrgPerson, "department" | "position" | "role" | "jobGroup" | "excluded" | "status">

// 한 사람 고치기. 평가 중이면 false를 돌려주고 바꾸지 않는다.
// 돌려주는 값 relationChanged: 평가 관계에 영향이 있는 변경인지 (부서·역할·평가 제외·재직 상태)
export function savePerson(employeeNo: string, change: OrgChange) {
  if (state.evaluationInProgress) return { saved: false, relationChanged: false }
  const before = state.people.find((person) => person.employeeNo === employeeNo)
  if (!before) return { saved: false, relationChanged: false }
  const relationChanged =
    before.department !== change.department ||
    before.role !== change.role ||
    before.excluded !== change.excluded ||
    before.status !== change.status
  update({
    ...state,
    people: state.people.map((person) =>
      person.employeeNo === employeeNo ? { ...person, ...change } : person,
    ),
  })
  return { saved: true, relationChanged }
}
