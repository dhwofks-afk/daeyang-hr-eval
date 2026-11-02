// 리포트용 가짜 데이터 (docs/03-리포트.md). 칸 이름은 docs/10-데이터설계.md 표를 따른다.
// 사람은 사원번호로 연결한다 (직원 명단은 src/data/people.ts).
// 11/4 실제 연결 때 평가 설정(cycles)의 결과 확정 칸(result_published)과 확정 결과 표(final_results)로 바꾼다.
// 결과는 관리자만 본다 (직원 "내 평가 결과" 화면 없음, 차장님 답변 11/2). 등급은 쓰지 않는다.
import { type StageKey } from "@/lib/scoring"

// 평가 설정 중 결과 확정 칸. resultPublished = 결과 확정 (DB 칸 이름은 그대로)
// publishedAt 예: 2026-11-04T14:00:00. 확정 전이면 null
export const reportSetting: {
  round: number
  resultPublished: boolean
  publishedAt: string | null
} = {
  round: 1,
  resultPublished: false,
  publishedAt: null,
}

// 확정 결과: [결과 확정]을 누른 순간의 결과 (확정 후 점수가 바뀌어도 이 값은 그대로)
// 단계 점수는 제출하지 않았거나 해당 없는 단계면 null (팀원은 상향 없음, 팀장은 팀장 평가 없음)
export type ConfirmedResult = {
  employeeNo: string
  department: string // 공개 당시 부서
  stages: Record<StageKey, number | null>
  weighted: number
  kpiApplied: number
  final: number
}

// 예전에 한 번 확정했다가 취소한 결과라고 가정한 몇 명분 (확정 취소해도 확정 결과는 남는다).
// 값은 예시 값이다 (점수 체계를 바꾸기 전 계산).
export const confirmedResults: ConfirmedResult[] = [
  // 생산 · 팀장 (역할 미리보기 "팀장")
  {
    employeeNo: "900010",
    department: "생산",
    stages: { self: 80, leader: null, executive: 76, upward: 76 },
    weighted: 76.6,
    kpiApplied: 77,
    final: 77,
  },
  // 생산 · 팀원 (역할 미리보기 "팀원")
  {
    employeeNo: "900011",
    department: "생산",
    stages: { self: 93, leader: 91, executive: 86, upward: null },
    weighted: 89.4,
    kpiApplied: 89.8,
    final: 89.8,
  },
]
