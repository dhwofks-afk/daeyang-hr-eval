// 목록 화면과 작성 화면이 함께 쓰는 화면 글자
import { type CaseStatus } from "@/data/evaluations"
import { type StageKey } from "@/lib/scoring"

export const statusNames: Record<CaseStatus, string> = {
  not_started: "작성 전",
  in_progress: "작성 중",
  submitted: "제출",
  returned: "반려",
}

export const stageNames: Record<StageKey, string> = {
  self: "자기 단계",
  leader: "팀장 단계",
  executive: "임원 단계",
  upward: "상향 단계",
  exec_upward: "임원 상향",
}
