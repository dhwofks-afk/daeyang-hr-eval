// 관리자 대시보드·진행 관리용 가짜 평가 건 목록 (docs/04-대시보드.md, docs/08-진행관리.md, docs/10-데이터설계.md 5번 표).
// 대시보드의 숫자는 이 목록을 세서 만든다. 11/4에 이 목록만 실제 cases 표로 바꾼다.
import { type StageKey } from "@/lib/scoring"
import { people } from "@/data/people"

// 상태 값은 cases 표와 같다: 작성 전 / 작성 중 / 제출 / 반려
export type CaseStatus = "not_started" | "in_progress" | "submitted" | "returned"

export type EvaluationCase = {
  id: number // 평가 건 번호 (진행 관리의 [반려]가 쓴다)
  targetNo: string
  evaluatorNo: string
  stage: StageKey
  status: CaseStatus
  submittedAt: string | null // 제출 시각. 반려된 건은 처음 제출한 시각이 남는다
}

type CaseStatusEntry = Pick<EvaluationCase, "targetNo" | "evaluatorNo" | "stage" | "status">

// 제출하지 않은 건 (31건). 여기 없는 건은 모두 "제출".
// scores.ts에서 점수가 없는(null) 단계는 여기서도 반드시 미제출로 둔다.
// 대상 부서마다 "받을 평가를 모두 제출받은" 직원이 1명 이상 남게 골랐다.
const unsubmitted: CaseStatusEntry[] = [
  // 경영기획부
  { targetNo: "900002", evaluatorNo: "900028", stage: "executive", status: "in_progress" },

  // 영업부
  { targetNo: "900007", evaluatorNo: "900007", stage: "self", status: "returned" },
  { targetNo: "900009", evaluatorNo: "900004", stage: "leader", status: "not_started" },
  { targetNo: "900008", evaluatorNo: "900028", stage: "executive", status: "not_started" },
  { targetNo: "900004", evaluatorNo: "900008", stage: "upward", status: "not_started" },

  // 생산 · 자기
  { targetNo: "900013", evaluatorNo: "900013", stage: "self", status: "not_started" },
  { targetNo: "900020", evaluatorNo: "900020", stage: "self", status: "returned" },
  { targetNo: "900024", evaluatorNo: "900024", stage: "self", status: "in_progress" },
  { targetNo: "900027", evaluatorNo: "900027", stage: "self", status: "in_progress" },
  // 생산 · 팀장
  { targetNo: "900014", evaluatorNo: "900010", stage: "leader", status: "in_progress" },
  { targetNo: "900015", evaluatorNo: "900010", stage: "leader", status: "not_started" },
  { targetNo: "900017", evaluatorNo: "900010", stage: "leader", status: "not_started" },
  { targetNo: "900018", evaluatorNo: "900010", stage: "leader", status: "not_started" },
  { targetNo: "900019", evaluatorNo: "900010", stage: "leader", status: "not_started" },
  { targetNo: "900020", evaluatorNo: "900010", stage: "leader", status: "not_started" },
  { targetNo: "900021", evaluatorNo: "900010", stage: "leader", status: "not_started" },
  // 생산 · 임원
  { targetNo: "900013", evaluatorNo: "900028", stage: "executive", status: "not_started" },
  { targetNo: "900023", evaluatorNo: "900028", stage: "executive", status: "in_progress" },
  { targetNo: "900024", evaluatorNo: "900028", stage: "executive", status: "not_started" },
  { targetNo: "900025", evaluatorNo: "900028", stage: "executive", status: "not_started" },
  { targetNo: "900026", evaluatorNo: "900028", stage: "executive", status: "not_started" },
  { targetNo: "900027", evaluatorNo: "900028", stage: "executive", status: "not_started" },
  // 생산 · 상향 (대상: 팀장 900010)
  { targetNo: "900010", evaluatorNo: "900013", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900014", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900018", stage: "upward", status: "in_progress" },
  { targetNo: "900010", evaluatorNo: "900019", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900021", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900023", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900025", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900026", stage: "upward", status: "not_started" },
  { targetNo: "900010", evaluatorNo: "900027", stage: "upward", status: "not_started" },
]

// 평가 건 목록: supabase/seed/04_cases.sql과 같은 규칙으로 만든다 (102건).
// 자기: 팀원·팀장 각자 / 팀장: 팀원마다 같은 부서 팀장 / 임원: 팀원·팀장 모두 (임원 1명) / 상향: 팀장마다 같은 부서 팀원 각자
function buildCases(): EvaluationCase[] {
  const targets = people.filter(
    (person) => person.role === "member" || person.role === "leader",
  )
  const executive = people
    .filter((person) => person.role === "executive")
    .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo))[0]
  const leaderOf = (department: string) =>
    people.find(
      (person) => person.department === department && person.role === "leader",
    )

  const cases: Omit<CaseStatusEntry, "status">[] = []
  for (const target of targets) {
    cases.push({ targetNo: target.employeeNo, evaluatorNo: target.employeeNo, stage: "self" })
    const leader = leaderOf(target.department)
    if (target.role === "member" && leader) {
      cases.push({ targetNo: target.employeeNo, evaluatorNo: leader.employeeNo, stage: "leader" })
    }
    if (executive) {
      cases.push({ targetNo: target.employeeNo, evaluatorNo: executive.employeeNo, stage: "executive" })
    }
    if (target.role === "leader") {
      for (const member of targets) {
        if (member.department === target.department && member.role === "member") {
          cases.push({ targetNo: target.employeeNo, evaluatorNo: member.employeeNo, stage: "upward" })
        }
      }
    }
  }

  return cases.map((item, index) => {
    const id = index + 1
    const found = unsubmitted.find(
      (entry) =>
        entry.targetNo === item.targetNo &&
        entry.evaluatorNo === item.evaluatorNo &&
        entry.stage === item.stage,
    )
    const status = found ? found.status : "submitted"
    return {
      id,
      ...item,
      status,
      submittedAt:
        status === "submitted" || status === "returned" ? fakeSubmittedAt(id) : null,
    }
  })
}

// 가짜 제출 시각: 10/20 ~ 10/27 근무 시간 안에서 평가 건 번호로 고르게 흩어 놓는다
function fakeSubmittedAt(id: number) {
  const two = (value: number) => String(value).padStart(2, "0")
  return `2026-10-${two(20 + (id % 8))}T${two(9 + (id % 9))}:${two((id * 7) % 60)}`
}

export const evaluationCases: EvaluationCase[] = buildCases()
