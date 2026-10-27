// 가짜 평가 진행 데이터. 사람은 사원번호로 연결한다.
// 숫자는 계산하지 않고 여기에 직접 적는다.

export type EvaluationState = "진행 중" | "미완료" | "제출 완료"

export type EvaluationProgress = {
  employeeNo: string
  state: EvaluationState
  progress: number
}

// 진행 중인 평가. 날짜는 관리자가 평가 목록 페이지에서 정하는 값이라
// 정해지기 전에는 null로 두고 화면에는 "미정"으로 보여 준다.
export const currentEvaluation: {
  name: string
  deadline: string | null
  deadlineDetail: string | null
} = {
  name: "정기 인사평가",
  deadline: null,
  deadlineDetail: null,
}

// 팀장 화면: 생산 팀원 17명의 자기평가 현황
export const leaderTeamProgress: EvaluationProgress[] = [
  { employeeNo: "900011", state: "진행 중", progress: 60 },
  { employeeNo: "900012", state: "진행 중", progress: 40 },
  { employeeNo: "900013", state: "미완료", progress: 0 },
  { employeeNo: "900014", state: "제출 완료", progress: 100 },
  { employeeNo: "900015", state: "제출 완료", progress: 100 },
  { employeeNo: "900016", state: "제출 완료", progress: 100 },
  { employeeNo: "900017", state: "제출 완료", progress: 100 },
  { employeeNo: "900018", state: "제출 완료", progress: 100 },
  { employeeNo: "900019", state: "제출 완료", progress: 100 },
  { employeeNo: "900020", state: "진행 중", progress: 20 },
  { employeeNo: "900021", state: "제출 완료", progress: 100 },
  { employeeNo: "900022", state: "제출 완료", progress: 100 },
  { employeeNo: "900023", state: "제출 완료", progress: 100 },
  { employeeNo: "900024", state: "제출 완료", progress: 100 },
  { employeeNo: "900025", state: "제출 완료", progress: 100 },
  { employeeNo: "900026", state: "제출 완료", progress: 100 },
  { employeeNo: "900027", state: "미완료", progress: 0 },
]

export const leaderTeamSummary = { total: 17, done: 12, remaining: 5 }

// 임원 화면: 배정된 평가 대상 (팀장 3명 / 팀원 24명)
export const executiveLeaderTargets: EvaluationProgress[] = [
  { employeeNo: "900001", state: "미완료", progress: 0 },
  { employeeNo: "900004", state: "진행 중", progress: 50 },
  { employeeNo: "900010", state: "제출 완료", progress: 100 },
]

export const executiveMemberTargets: EvaluationProgress[] = [
  { employeeNo: "900002", state: "제출 완료", progress: 100 },
  { employeeNo: "900003", state: "진행 중", progress: 30 },
  { employeeNo: "900005", state: "제출 완료", progress: 100 },
  { employeeNo: "900006", state: "미완료", progress: 0 },
  { employeeNo: "900007", state: "제출 완료", progress: 100 },
  { employeeNo: "900008", state: "진행 중", progress: 50 },
  { employeeNo: "900009", state: "미완료", progress: 0 },
  { employeeNo: "900011", state: "진행 중", progress: 20 },
  { employeeNo: "900012", state: "제출 완료", progress: 100 },
  { employeeNo: "900013", state: "미완료", progress: 0 },
  { employeeNo: "900014", state: "제출 완료", progress: 100 },
  { employeeNo: "900015", state: "제출 완료", progress: 100 },
  { employeeNo: "900016", state: "제출 완료", progress: 100 },
  { employeeNo: "900017", state: "미완료", progress: 0 },
  { employeeNo: "900018", state: "미완료", progress: 0 },
  { employeeNo: "900019", state: "진행 중", progress: 40 },
  { employeeNo: "900020", state: "미완료", progress: 0 },
  { employeeNo: "900021", state: "미완료", progress: 0 },
  { employeeNo: "900022", state: "미완료", progress: 0 },
  { employeeNo: "900023", state: "제출 완료", progress: 100 },
  { employeeNo: "900024", state: "미완료", progress: 0 },
  { employeeNo: "900025", state: "미완료", progress: 0 },
  { employeeNo: "900026", state: "미완료", progress: 0 },
  { employeeNo: "900027", state: "미완료", progress: 0 },
]

export const executiveTargetSummary = { total: 27, done: 9, remaining: 18 }

// 평가 목록 카드에 보일 진행 상태
export const myEvaluationCards = {
  member: {
    count: 2,
    self: { state: "진행 중" as EvaluationState, progress: 60 },
    leader: { state: "미완료" as EvaluationState, progress: 0 },
  },
  leader: {
    count: 2,
    self: { state: "미완료" as EvaluationState, progress: 0 },
    team: { state: "진행 중" as EvaluationState, progress: 35, done: 6, total: 17 },
  },
  executive: {
    targets: {
      state: "진행 중" as EvaluationState,
      progress: 33,
      done: 9,
      total: 27,
      leaders: 3,
      members: 24,
    },
  },
}
