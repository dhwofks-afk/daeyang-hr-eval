// 만족도 가짜 데이터 (역할 미리보기용). 칸은 서버 satisfaction 표와 같다: 회차 · 점수(1~5) · 의견(선택).
// 작성자·작성 시각 칸은 서버에도 없다 (관리자도 누가 썼는지 모른다).
// 일반적인 문장만 넣었다 (실제 사람의 내용이 아니다).

export type SatisfactionAnswer = {
  round: number // 회차
  score: number // 1 매우 불만족 ~ 5 매우 만족
  comment: string | null // 의견 (선택)
}

export const satisfactionAnswers: SatisfactionAnswer[] = [
  { round: 1, score: 5, comment: "휴대폰으로 바로 할 수 있어 편했습니다." },
  { round: 1, score: 4, comment: "문항이 이해하기 쉬웠습니다." },
  { round: 1, score: 4, comment: null },
  { round: 1, score: 3, comment: "문항 수가 조금 많은 것 같습니다." },
  { round: 1, score: 5, comment: null },
  { round: 1, score: 4, comment: "마감 전에 알림이 오면 좋겠습니다." },
  { round: 1, score: 2, comment: "글씨를 더 크게 볼 수 있으면 좋겠습니다." },
  { round: 1, score: 4, comment: null },
  { round: 1, score: 3, comment: null },
  { round: 1, score: 5, comment: "종이로 할 때보다 빨리 끝났습니다." },
  { round: 1, score: 4, comment: null },
  { round: 1, score: 4, comment: null },
  { round: 1, score: 3, comment: "평가 기준 설명이 조금 더 있으면 좋겠습니다." },
  { round: 1, score: 5, comment: null },
  { round: 1, score: 4, comment: null },
  { round: 1, score: 1, comment: null },
  { round: 1, score: 4, comment: null },
  { round: 1, score: 3, comment: null },
  { round: 1, score: 5, comment: null },
  { round: 1, score: 4, comment: null },
]

// 만족도를 낼 사람 수 (가짜 데이터: 자기평가를 하는 팀원·팀장 27명)
export const satisfactionTargetCount = 27
