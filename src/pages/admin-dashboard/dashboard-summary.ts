// 대시보드 숫자 계산. 평가 건 목록을 받아서 센다 (숫자를 저장하지 않는다).
// 지금은 src/data/dashboard.ts의 가짜 목록을, 11/4부터는 실제 cases 표를 넘긴다.
// 점수는 직접 계산하지 않고 src/lib/scoring.ts 결과만 쓴다.
import { type EvaluationCase } from "@/data/dashboard"
import { type Person } from "@/data/people"
import { departmentAverage, type ScoreResult, type StageKey } from "@/lib/scoring"

export type Count = { submitted: number; total: number; rate: number }

const stages: StageKey[] = ["self", "leader", "executive", "upward"]

const isSubmitted = (item: EvaluationCase) => item.status === "submitted"

// 제출 건수 / 전체 건수. 비율은 정수 % (건이 없으면 0)
function count(cases: EvaluationCase[]): Count {
  const submitted = cases.filter(isSubmitted).length
  const total = cases.length
  return {
    submitted,
    total,
    rate: total ? Math.round((submitted / total) * 100) : 0,
  }
}

// 전체 제출률 (상향 평가 포함)
export const overallProgress = (cases: EvaluationCase[]) => count(cases)

// 단계별 제출: 자기·팀장·임원·상향. 네 단계를 더하면 전체와 같다.
export const stageProgress = (cases: EvaluationCase[]) =>
  stages.map((stage) => ({
    stage,
    ...count(cases.filter((item) => item.stage === stage)),
  }))

// 미제출 평가자: 제출하지 않은 건(작성 전·작성 중·반려)이 하나라도 있는 평가자
export function pendingEvaluators(cases: EvaluationCase[], people: Person[]) {
  const numbers = new Set(
    cases.filter((item) => !isSubmitted(item)).map((item) => item.evaluatorNo),
  )
  return people.filter((person) => numbers.has(person.employeeNo))
}

// 부서별 제출률. 평가 대상의 부서로 센다 (임원이 평가자인 건도 대상 부서에 들어간다)
export function departmentProgress(
  cases: EvaluationCase[],
  people: Person[],
  departmentNames: string[],
) {
  const departmentOf = new Map(
    people.map((person) => [person.employeeNo, person.department]),
  )
  return departmentNames.map((name) => ({
    name,
    ...count(cases.filter((item) => departmentOf.get(item.targetNo) === name)),
  }))
}

// 마감까지 남은 날: 미정 / D-n / D-day / 마감 지남. 마감일은 "2026-11-20" 꼴
export function deadlineLabel(deadline: string | null, today = new Date()) {
  if (!deadline) return "미정"
  const [year, month, day] = deadline.split("-").map(Number)
  const end = new Date(year, month - 1, day)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000)
  if (days > 0) return `D-${days}`
  return days === 0 ? "D-day" : "마감 지남"
}

// 받아야 할 평가 건이 모두 "제출"인 평가 대상의 사원번호
// (팀장은 자기·임원 평가에 더해 팀원들의 상향 평가까지 모두 제출되어야 한다)
export function fullySubmittedTargets(cases: EvaluationCase[]) {
  const pending = new Set(
    cases.filter((item) => !isSubmitted(item)).map((item) => item.targetNo),
  )
  return new Set(
    cases.map((item) => item.targetNo).filter((targetNo) => !pending.has(targetNo)),
  )
}

// 부서별 평균 점수: 모두 제출받은 직원만 모아 scoring.ts의 departmentAverage로 계산한다.
// 그런 직원이 없는 부서는 null (화면에는 "평가 진행 중")
// counted / total: 평균에 들어간 직원 수 / 그 부서의 평가 대상 전체 (평가 결과 페이지는 전원 기준이라 기준을 함께 보여 준다)
export function departmentScores(
  cases: EvaluationCase[],
  results: ScoreResult[],
  departmentNames: string[],
) {
  const done = fullySubmittedTargets(cases)
  const doneResults = results.filter((result) => done.has(result.employeeNo))
  const countIn = (list: ScoreResult[], name: string) =>
    list.filter((result) => result.department === name).length
  return departmentNames.map((name) => ({
    name,
    average: departmentAverage(doneResults, name),
    counted: countIn(doneResults, name),
    total: countIn(results, name),
  }))
}
