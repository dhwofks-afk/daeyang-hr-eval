// 리포트 전용 가짜 종합 의견 (역할 미리보기에서만 쓴다. 실제 로그인이면 평가 건의 의견 칸을 읽는다).
// 평가자 정보 없이 단계만 둔다. 일반적인 문장만 넣었다 (실제 사람의 내용이 아니다).
// 자기평가에는 종합 의견이 없다 (평가 작성 화면 기준).
import { type PersonRole } from "@/data/people"
import { type StageKey } from "@/lib/scoring"

export type StageOpinion = { stage: StageKey; opinion: string }

const leaderOpinions = [
  "맡은 일을 꾸준하고 정확하게 처리했습니다. 일정 관리에 조금 더 신경 쓰면 좋겠습니다.",
  "동료와 협업이 원활하고, 새로 온 직원을 잘 도와주었습니다.",
  "개선 아이디어를 적극적으로 내고 실행했습니다.",
]

const executiveOpinions = [
  "부서 목표 달성에 꾸준히 기여했습니다.",
  "책임감 있게 업무를 마무리했습니다. 보고를 조금 더 자주 하면 좋겠습니다.",
  "현장 문제를 빠르게 찾아 해결했습니다.",
]

// 상향 평가 의견은 여러 명이 쓴다 (익명)
const upwardOpinions = [
  "업무 지시가 분명해서 일하기 편합니다.",
  "의견을 잘 들어 주시고 피드백을 빨리 주십니다.",
  "바쁠 때 일을 고르게 나눠 주시면 좋겠습니다.",
  "회의 결과를 팀에 잘 공유해 주십니다.",
]

const pick = (list: string[], seed: number) => list[seed % list.length]

// 사원번호 끝자리로 문장을 고른다 (같은 사람은 늘 같은 의견)
export function fakeOpinionsOf(employeeNo: string, role: PersonRole | undefined): StageOpinion[] {
  const seed = Number(employeeNo.slice(-2)) || 0
  const many = (stage: StageKey) =>
    [0, 1, 2].map((index) => ({ stage, opinion: pick(upwardOpinions, seed + index) }))
  if (role === "executive") return many("exec_upward")
  if (role === "leader") {
    return [{ stage: "executive", opinion: pick(executiveOpinions, seed) }, ...many("upward")]
  }
  return [
    { stage: "leader", opinion: pick(leaderOpinions, seed) },
    { stage: "executive", opinion: pick(executiveOpinions, seed + 1) },
  ]
}
