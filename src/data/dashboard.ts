// 관리자 대시보드에 보일 가짜 숫자 (27명 기준). 계산하지 않고 여기에 직접 적는다.
// (이후 실제 응답 기반 그래프로 교체 예정)

export const responseSummary = { rate: 70, completed: 19, pending: 8, total: 27 }

export const departmentScores = [
  { name: "경영기획부", score: 84.3 },
  { name: "영업부", score: 81.6 },
  { name: "생산", score: 79.8 },
]

// 마감까지 남은 날. 마감일이 정해지지 않았으면 null (화면에는 "미정")
export const deadlineCountdown: { days: number | null; detail: string | null } = {
  days: null,
  detail: null,
}

// 다가오는 일정. 날짜가 정해지지 않았으면 date·day는 null (화면에는 "미정")
export const schedule: {
  date: string | null
  day: string | null
  title: string
  detail: string
  tone: string
}[] = [
  {
    date: null,
    day: null,
    title: "인사평가 시작",
    detail: "팀원 평가 응답 기간",
    tone: "cyan",
  },
  {
    date: null,
    day: null,
    title: "팀장 평가 마감",
    detail: "제출 시각 미정",
    tone: "blue",
  },
  {
    date: null,
    day: null,
    title: "임원 평가 마감",
    detail: "제출 시각 미정",
    tone: "teal",
  },
]
