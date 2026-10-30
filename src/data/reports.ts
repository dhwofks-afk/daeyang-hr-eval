// 리포트·내 평가 결과용 가짜 데이터 (docs/03-리포트.md). 칸 이름은 docs/10-데이터설계.md 표를 따른다.
// 사람은 사원번호로 연결한다 (직원 명단은 src/data/people.ts).
// 11/4 실제 연결 때 평가 설정(cycles)의 공개 칸과 확정 결과 표(final_results)로 바꾼다.
import { type Grade, type StageKey } from "@/lib/scoring"

// 공개 범위 항목. 전 직원에게 일괄 적용한다.
// - columns: 확정 결과 표(final_results)에서 이 항목이 보여 주는 칸. 서버 공개 범위(public_scope)에 이 이름이 들어간다
// - leaderOnly: 팀장에게만 보이는 항목 (팀원 화면에는 체크해도 나오지 않는다)
// - ready: false면 서버에 아직 칸이 없어 체크할 수 없다 (화면에 "준비 중")
export type PublicScopeKey =
  | "final"
  | "grade"
  | "stages"
  | "fields"
  | "opinion"
  | "upward"

export const publicScopeItems: {
  key: PublicScopeKey
  label: string
  columns: string[]
  leaderOnly: boolean
  ready: boolean
}[] = [
  { key: "final", label: "최종 점수", columns: ["final"], leaderOnly: false, ready: true },
  { key: "grade", label: "등급", columns: ["grade"], leaderOnly: false, ready: true },
  {
    key: "stages",
    label: "단계별 점수 (자기·팀장·임원)",
    columns: ["score_self", "score_leader", "score_executive"],
    leaderOnly: false,
    ready: true,
  },
  { key: "fields", label: "분야별 점수", columns: [], leaderOnly: false, ready: false },
  { key: "opinion", label: "평가 의견", columns: [], leaderOnly: false, ready: false },
  { key: "upward", label: "상향 평가 점수 (팀장에게만)", columns: ["score_upward"], leaderOnly: true, ready: true },
]

// 평가 설정 중 공개 관련 칸. 기본값은 미공개·공개 범위 비어 있음 (전부 미공개)
// publishedAt 예: 2026-11-04T14:00:00. 공개 전이면 null
export const reportSetting: {
  round: number
  resultPublished: boolean
  publishedAt: string | null
  publicScope: PublicScopeKey[]
} = {
  round: 1,
  resultPublished: false,
  publishedAt: null,
  publicScope: [],
}

// 확정 결과: [결과 공개]를 누른 순간의 결과 (공개 후 관리자가 점수를 바꿔도 이 값은 그대로)
// 단계 점수는 제출하지 않았거나 해당 없는 단계면 null (팀원은 상향 없음, 팀장은 팀장 평가 없음)
export type ConfirmedResult = {
  employeeNo: string
  department: string // 공개 당시 부서
  stages: Record<StageKey, number | null>
  weighted: number
  kpiApplied: number
  final: number
  grade: Grade
}

// 예전에 한 번 공개했다가 취소한 결과라고 가정한 몇 명분 (공개 취소해도 확정 결과는 남는다).
// 값은 src/data/scores.ts 점수를 scoring.ts 규칙으로 계산한 것. 등급은 예시 값이다.
export const confirmedResults: ConfirmedResult[] = [
  // 생산 · 팀장 (역할 미리보기 "팀장")
  {
    employeeNo: "900010",
    department: "생산",
    stages: { self: 80, leader: null, executive: 76, upward: 76 },
    weighted: 76.6,
    kpiApplied: 77,
    final: 77,
    grade: "C",
  },
  // 생산 · 팀원 (역할 미리보기 "팀원")
  {
    employeeNo: "900011",
    department: "생산",
    stages: { self: 93, leader: 91, executive: 86, upward: null },
    weighted: 89.4,
    kpiApplied: 89.8,
    final: 89.8,
    grade: "A",
  },
]
