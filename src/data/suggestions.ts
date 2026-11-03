// 건의함 가짜 데이터 (docs/17-건의함.md). 칸은 서버 suggestions 표와 같다: 회차 · 내용.
// 작성자·작성 시각 칸은 서버에도 없다 (관리자도 누가 썼는지 모른다). 번호도 두지 않는다.
// 일반적인 문장만 넣었다 (실제 사람의 내용이 아니다). 11/4 실제 연결 때 suggestions 표 읽기로 바꾼다.

export type Suggestion = {
  round: number // 회차
  content: string // 내용
}

export const suggestions: Suggestion[] = [
  { round: 1, content: "휴게실에 정수기를 한 대 더 두면 좋겠습니다." },
  { round: 1, content: "교육 일정을 한 달 전에 미리 알려 주시면 업무 조정이 쉬울 것 같습니다." },
  { round: 1, content: "평가 문항 중 비슷한 내용이 있어 정리되면 좋겠습니다." },
  { round: 1, content: "겨울철 작업장 난방을 조금 더 일찍 켜 주시면 좋겠습니다." },
  { round: 1, content: "부서 간 회의 결과를 공유하는 게시판이 있으면 좋겠습니다." },
  { round: 1, content: "안전 장비 교체 주기를 짧게 해 주시면 좋겠습니다." },
  { round: 1, content: "주차 공간이 부족해 출근 시간에 불편합니다." },
  { round: 1, content: "새로 온 직원을 위한 업무 안내 자료가 있으면 좋겠습니다." },
]
