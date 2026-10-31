// 평가 목록 페이지 전용 문구: "평가하기" 팝업(안내문 → 작성 전 경고)과 미제출 안내 띠.
// 회사 확인 전 임시 문구다 (docs/마스터플랜.md 12번: 안내문 자료를 회사에 다시 요청함).
// 문구는 docs/10-데이터설계.md와 CLAUDE.md 용어 사전에 적힌 규칙만 옮겼다.
// 기간처럼 정해지지 않은 값은 화면에서 "미정"으로 채운다.

export type NoticeItem = {
  label: string
  text: string
}

export type NoticeStep = {
  title: string
  items: NoticeItem[]
}

// 1단계: 평가 안내문. "{기간}"은 화면에서 평가 기간으로 바꿔 넣는다.
export const guideStep: NoticeStep = {
  title: "평가 안내",
  items: [
    {
      label: "목적",
      text: "한 해 동안의 업무성과와 역량을 돌아보고, 공정한 인사 운영에 활용합니다.",
    },
    {
      label: "기간",
      text: "{기간}",
    },
    {
      label: "익명성",
      text: "상향 평가는 익명입니다. 작성자는 관리자만 확인할 수 있습니다.",
    },
    {
      label: "작성 방법",
      text: "모든 문항에 답해야 제출할 수 있습니다. 건의사항만 선택입니다.",
    },
  ],
}

// 2단계: 작성 전 경고
export const warningStep: NoticeStep = {
  title: "작성 전 꼭 확인해 주세요",
  items: [
    {
      label: "제출 후 잠김",
      text: "제출하면 수정할 수 없습니다. 제출 전에 다시 한번 확인해 주세요.",
    },
    {
      label: "미제출 0점",
      text: "마감까지 제출하지 않은 평가는 0점으로 계산됩니다.",
    },
  ],
}

// 목록 맨 위 안내 띠. "{개수}"는 아직 제출하지 않은 평가 수로 바꿔 넣는다.
export const pendingBanner = {
  title: "아직 제출하지 않은 평가가 {개수}건 있어요.",
  text: "마감까지 제출하지 않은 평가는 0점으로 계산됩니다.",
}
