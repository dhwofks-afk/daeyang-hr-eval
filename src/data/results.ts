// 내 결과 페이지에 보일 가짜 값. 날짜가 정해지지 않았으면 null (화면에는 "미정")

export const myLatestResult: {
  evaluationName: string
  endDate: string | null
  finalScore: number
} = {
  evaluationName: "정기 인사평가",
  endDate: null,
  finalScore: 84.6,
}
