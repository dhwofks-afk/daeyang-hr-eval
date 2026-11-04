// 평가 작성용 가짜 데이터 (docs/06-평가작성.md, docs/10-데이터설계.md 4·5·6번 표).
// 칸 이름은 supabase 표(questions · cases · answers)와 같은 뜻으로 맞췄다. 사람은 사원번호로 연결한다.
// 발표 장면(팀원 자기평가 → 팀장 → 임원)에 맞춘 상태라 대시보드(dashboard.ts) 가짜 목록과는 따로 간다.
// 11/4에 이 파일의 목록들을 실제 표 읽기로 바꾼다.
import { type StageKey } from "@/lib/scoring"
import { findPerson, people, type Person, positions } from "@/data/people"

// 진행 중인 회차. 마감일은 관리자가 정하기 전까지 null (화면에는 "미정")
export const currentEvaluation: {
  name: string
  deadline: string | null
} = {
  name: "정기 인사평가",
  deadline: null,
}

// ---------- 문항 (questions) ----------

export type QuestionSet =
  | "office_member"
  | "office_leader"
  | "production_member"
  | "production_leader"
  | "upward"

export type Question = {
  id: number
  questionSet: QuestionSet
  field: string // 분야
  factor: string // 평정요소
  factorPoints: number // 평정요소 배점 (세트마다 합 100)
  content: string // 문구
  type: "choice" | "essay" // 객관식 1~5 / 서술형 0~배점
  sortOrder: number
}

// supabase/seed/03_questions.sql에서 옮겼다. 팀원 평가표는 평정요소마다 첫 문항 하나씩만,
// 팀장·상향 평가표(11/4 새 평가표)는 전체를 옮겼다. 평정요소를 빠짐없이 넣었으므로 세트마다 배점 합은 100이다.
export const questions: Question[] = [
  { id: 1, questionSet: "office_member", field: "업무성과", factor: "본인서술형", factorPoints: 8, content: "본인의 주요 활동 및 성과 기재", type: "essay", sortOrder: 1 },
  { id: 2, questionSet: "office_member", field: "업무성과", factor: "고객(직원) 만족", factorPoints: 7, content: "고객(직원)들이 (피평가자를) 신뢰하고 있다", type: "choice", sortOrder: 2 },
  { id: 3, questionSet: "office_member", field: "업무성과", factor: "업무의 양과 질", factorPoints: 8, content: "평가대상기간 중 수행한 업무량이 다른 직원들에 비해 상대적으로 많다", type: "choice", sortOrder: 6 },
  { id: 4, questionSet: "office_member", field: "업무성과", factor: "업무의 난이도", factorPoints: 5, content: "다른 직원들이 힘들어 하는 업무도 비교적 성공적으로 수행해 낸다", type: "choice", sortOrder: 11 },
  { id: 5, questionSet: "office_member", field: "업무성과", factor: "업무관리", factorPoints: 7, content: "업무 계획을 적절하게 수립하여 주어진 업무를 효율적으로 수행하고 완료한다", type: "choice", sortOrder: 14 },
  { id: 6, questionSet: "office_member", field: "능력", factor: "직무능력", factorPoints: 5, content: "업무를 원활하게 수행할 수 있는 지식 또는 기능을 보유하고 있다", type: "choice", sortOrder: 18 },
  { id: 7, questionSet: "office_member", field: "능력", factor: "소통능력", factorPoints: 5, content: "의사소통 능력이 뛰어나고 상대방을 설득하는 능력이 있다", type: "choice", sortOrder: 21 },
  { id: 8, questionSet: "office_member", field: "능력", factor: "판단능력", factorPoints: 5, content: "자신의 직무를 정확하게 파악하고 실행한다", type: "choice", sortOrder: 24 },
  { id: 9, questionSet: "office_member", field: "능력", factor: "기타", factorPoints: 5, content: "직무와 관련된 문제점, 개선사항 등을 정확하게 분석하여 보고한다", type: "choice", sortOrder: 27 },
  { id: 10, questionSet: "office_member", field: "근무태도", factor: "근무태도", factorPoints: 20, content: "보고 없이 또는 불분명한 사유로 지각, 조퇴, 외출, 결근 등을 하지 않는다", type: "choice", sortOrder: 31 },
  { id: 11, questionSet: "office_member", field: "보안·규정 준수", factor: "보안·규정 준수", factorPoints: 10, content: "대외비 자료가 유출되지 않도록 주의를 기울인다", type: "choice", sortOrder: 34 },
  { id: 12, questionSet: "office_member", field: "조직문화", factor: "조직문화", factorPoints: 15, content: "업무 수행에 있어 상사와 동료에게 적극적으로 협조한다", type: "choice", sortOrder: 36 },
  { id: 13, questionSet: "office_leader", field: "업무성과", factor: "부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적", factorPoints: 30, content: "부서 목표 달성도", type: "choice", sortOrder: 1 },
  { id: 14, questionSet: "office_leader", field: "업무성과", factor: "부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적", factorPoints: 30, content: "업무 추진실적", type: "choice", sortOrder: 2 },
  { id: 15, questionSet: "office_leader", field: "업무성과", factor: "부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적", factorPoints: 30, content: "성과 창출 및 개선실적", type: "choice", sortOrder: 3 },
  { id: 16, questionSet: "office_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "업무분장", type: "choice", sortOrder: 4 },
  { id: 17, questionSet: "office_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "구성원 지도·육성", type: "choice", sortOrder: 5 },
  { id: 18, questionSet: "office_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "갈등 조정", type: "choice", sortOrder: 6 },
  { id: 19, questionSet: "office_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "조직 운영능력", type: "choice", sortOrder: 7 },
  { id: 20, questionSet: "office_leader", field: "직무역량 및 의사결정", factor: "직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성", factorPoints: 20, content: "직무 전문성", type: "choice", sortOrder: 8 },
  { id: 21, questionSet: "office_leader", field: "직무역량 및 의사결정", factor: "직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성", factorPoints: 20, content: "문제해결 능력", type: "choice", sortOrder: 9 },
  { id: 22, questionSet: "office_leader", field: "직무역량 및 의사결정", factor: "직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성", factorPoints: 20, content: "상황 판단 및 의사결정의 적절성", type: "choice", sortOrder: 10 },
  { id: 23, questionSet: "office_leader", field: "책임감 및 규정준수", factor: "관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응", factorPoints: 15, content: "관리자로서의 책임 이행", type: "choice", sortOrder: 11 },
  { id: 24, questionSet: "office_leader", field: "책임감 및 규정준수", factor: "관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응", factorPoints: 15, content: "회사규정 준수", type: "choice", sortOrder: 12 },
  { id: 25, questionSet: "office_leader", field: "책임감 및 규정준수", factor: "관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응", factorPoints: 15, content: "리스크 예방 및 대응", type: "choice", sortOrder: 13 },
  { id: 26, questionSet: "office_leader", field: "협업 및 조직기여", factor: "타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여", factorPoints: 10, content: "타 부서 협력", type: "choice", sortOrder: 14 },
  { id: 27, questionSet: "office_leader", field: "협업 및 조직기여", factor: "타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여", factorPoints: 10, content: "경영방침 이행", type: "choice", sortOrder: 15 },
  { id: 28, questionSet: "office_leader", field: "협업 및 조직기여", factor: "타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여", factorPoints: 10, content: "조직 전체의 목표 달성 기여", type: "choice", sortOrder: 16 },
  { id: 29, questionSet: "production_member", field: "업무성과", factor: "본인서술형", factorPoints: 8, content: "본인의 주요 활동 및 성과 기재", type: "essay", sortOrder: 1 },
  { id: 30, questionSet: "production_member", field: "업무성과", factor: "업무의 양과 질", factorPoints: 10, content: "평가대상기간 중 수행한 작업이 다른 직원들에 비해 상대적으로 많다", type: "choice", sortOrder: 2 },
  { id: 31, questionSet: "production_member", field: "업무성과", factor: "업무의 난이도", factorPoints: 8, content: "다른 직원들이 힘들어 하는 작업도 비교적 성공적으로 수행해 낸다", type: "choice", sortOrder: 7 },
  { id: 32, questionSet: "production_member", field: "업무성과", factor: "업무관리", factorPoints: 9, content: "생산 계획을 적절하게 수립하여 주어진 작업을 효율적으로 수행하고 완료한다", type: "choice", sortOrder: 10 },
  { id: 33, questionSet: "production_member", field: "능력", factor: "직무능력", factorPoints: 5, content: "작업을 원활하게 수행할 수 있는 지식 또는 기능을 보유하고 있다", type: "choice", sortOrder: 15 },
  { id: 34, questionSet: "production_member", field: "능력", factor: "소통능력", factorPoints: 5, content: "의사소통 능력이 뛰어나고 상대방을 설득하는 능력이 있다", type: "choice", sortOrder: 18 },
  { id: 35, questionSet: "production_member", field: "능력", factor: "판단능력", factorPoints: 5, content: "자신의 직무를 정확하게 파악하고 실행한다", type: "choice", sortOrder: 20 },
  { id: 36, questionSet: "production_member", field: "능력", factor: "기타", factorPoints: 5, content: "작업과 관련된 문제점, 개선사항 등을 정확하게 분석하여 보고한다", type: "choice", sortOrder: 23 },
  { id: 37, questionSet: "production_member", field: "근무태도", factor: "근무태도", factorPoints: 20, content: "보고 없이 또는 불분명한 사유로 지각, 조퇴, 외출, 결근 등을 하지 않는다", type: "choice", sortOrder: 26 },
  { id: 38, questionSet: "production_member", field: "보안·규정 준수", factor: "보안·규정 준수", factorPoints: 10, content: "대외비 자료가 유출되지 않도록 주의를 기울인다", type: "choice", sortOrder: 29 },
  { id: 39, questionSet: "production_member", field: "조직문화", factor: "조직문화", factorPoints: 15, content: "작업 수행에 있어 상사와 동료에게 적극적으로 협조한다", type: "choice", sortOrder: 32 },
  { id: 40, questionSet: "production_leader", field: "업무성과", factor: "부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적", factorPoints: 30, content: "부서 목표 달성도", type: "choice", sortOrder: 1 },
  { id: 41, questionSet: "production_leader", field: "업무성과", factor: "부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적", factorPoints: 30, content: "업무 추진실적", type: "choice", sortOrder: 2 },
  { id: 42, questionSet: "production_leader", field: "업무성과", factor: "부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적", factorPoints: 30, content: "성과 창출 및 개선실적", type: "choice", sortOrder: 3 },
  { id: 43, questionSet: "production_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "업무분장", type: "choice", sortOrder: 4 },
  { id: 44, questionSet: "production_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "구성원 지도·육성", type: "choice", sortOrder: 5 },
  { id: 45, questionSet: "production_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "갈등 조정", type: "choice", sortOrder: 6 },
  { id: 46, questionSet: "production_leader", field: "리더십 및 조직관리", factor: "업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력", factorPoints: 25, content: "조직 운영능력", type: "choice", sortOrder: 7 },
  { id: 47, questionSet: "production_leader", field: "직무역량 및 의사결정", factor: "직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성", factorPoints: 20, content: "직무 전문성", type: "choice", sortOrder: 8 },
  { id: 48, questionSet: "production_leader", field: "직무역량 및 의사결정", factor: "직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성", factorPoints: 20, content: "문제해결 능력", type: "choice", sortOrder: 9 },
  { id: 49, questionSet: "production_leader", field: "직무역량 및 의사결정", factor: "직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성", factorPoints: 20, content: "상황 판단 및 의사결정의 적절성", type: "choice", sortOrder: 10 },
  { id: 50, questionSet: "production_leader", field: "책임감 및 규정준수", factor: "관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응", factorPoints: 15, content: "관리자로서의 책임 이행", type: "choice", sortOrder: 11 },
  { id: 51, questionSet: "production_leader", field: "책임감 및 규정준수", factor: "관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응", factorPoints: 15, content: "회사규정 준수", type: "choice", sortOrder: 12 },
  { id: 52, questionSet: "production_leader", field: "책임감 및 규정준수", factor: "관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응", factorPoints: 15, content: "리스크 예방 및 대응", type: "choice", sortOrder: 13 },
  { id: 53, questionSet: "production_leader", field: "협업 및 조직기여", factor: "타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여", factorPoints: 10, content: "타 부서 협력", type: "choice", sortOrder: 14 },
  { id: 54, questionSet: "production_leader", field: "협업 및 조직기여", factor: "타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여", factorPoints: 10, content: "경영방침 이행", type: "choice", sortOrder: 15 },
  { id: 55, questionSet: "production_leader", field: "협업 및 조직기여", factor: "타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여", factorPoints: 10, content: "조직 전체의 목표 달성 기여", type: "choice", sortOrder: 16 },
  { id: 56, questionSet: "upward", field: "업무지시 및 관리능력", factor: "업무지시의 명확성, 업무분장의 적정성, 업무 진행상황 관리", factorPoints: 25, content: "업무지시의 명확성", type: "choice", sortOrder: 1 },
  { id: 57, questionSet: "upward", field: "업무지시 및 관리능력", factor: "업무지시의 명확성, 업무분장의 적정성, 업무 진행상황 관리", factorPoints: 25, content: "업무분장의 적정성", type: "choice", sortOrder: 2 },
  { id: 58, questionSet: "upward", field: "업무지시 및 관리능력", factor: "업무지시의 명확성, 업무분장의 적정성, 업무 진행상황 관리", factorPoints: 25, content: "업무 진행상황 관리", type: "choice", sortOrder: 3 },
  { id: 59, questionSet: "upward", field: "리더십 및 의사결정", factor: "문제해결 능력, 합리적인 의사결정, 책임 있는 업무처리", factorPoints: 25, content: "문제해결 능력", type: "choice", sortOrder: 4 },
  { id: 60, questionSet: "upward", field: "리더십 및 의사결정", factor: "문제해결 능력, 합리적인 의사결정, 책임 있는 업무처리", factorPoints: 25, content: "합리적인 의사결정", type: "choice", sortOrder: 5 },
  { id: 61, questionSet: "upward", field: "리더십 및 의사결정", factor: "문제해결 능력, 합리적인 의사결정, 책임 있는 업무처리", factorPoints: 25, content: "책임 있는 업무처리", type: "choice", sortOrder: 6 },
  { id: 62, questionSet: "upward", field: "소통 및 피드백", factor: "구성원 의견 경청, 원활한 의사소통, 적절한 업무지도 및 피드백", factorPoints: 20, content: "구성원 의견 경청", type: "choice", sortOrder: 7 },
  { id: 63, questionSet: "upward", field: "소통 및 피드백", factor: "구성원 의견 경청, 원활한 의사소통, 적절한 업무지도 및 피드백", factorPoints: 20, content: "원활한 의사소통", type: "choice", sortOrder: 8 },
  { id: 64, questionSet: "upward", field: "소통 및 피드백", factor: "구성원 의견 경청, 원활한 의사소통, 적절한 업무지도 및 피드백", factorPoints: 20, content: "적절한 업무지도 및 피드백", type: "choice", sortOrder: 9 },
  { id: 65, questionSet: "upward", field: "공정성 및 신뢰성", factor: "구성원에 대한 공정한 대우, 객관적인 업무평가, 일관된 원칙 적용", factorPoints: 20, content: "구성원에 대한 공정한 대우", type: "choice", sortOrder: 10 },
  { id: 66, questionSet: "upward", field: "공정성 및 신뢰성", factor: "구성원에 대한 공정한 대우, 객관적인 업무평가, 일관된 원칙 적용", factorPoints: 20, content: "객관적인 업무평가", type: "choice", sortOrder: 11 },
  { id: 67, questionSet: "upward", field: "공정성 및 신뢰성", factor: "구성원에 대한 공정한 대우, 객관적인 업무평가, 일관된 원칙 적용", factorPoints: 20, content: "일관된 원칙 적용", type: "choice", sortOrder: 12 },
  { id: 68, questionSet: "upward", field: "조직문화 및 협업", factor: "상호존중, 갈등관리, 협력적인 근무환경 조성", factorPoints: 10, content: "상호존중", type: "choice", sortOrder: 13 },
  { id: 69, questionSet: "upward", field: "조직문화 및 협업", factor: "상호존중, 갈등관리, 협력적인 근무환경 조성", factorPoints: 10, content: "갈등관리", type: "choice", sortOrder: 14 },
  { id: 70, questionSet: "upward", field: "조직문화 및 협업", factor: "상호존중, 갈등관리, 협력적인 근무환경 조성", factorPoints: 10, content: "협력적인 근무환경 조성", type: "choice", sortOrder: 15 },
]

// ---------- 평가 건 (cases) ----------

// 상태: 작성 전 / 작성 중 / 제출 / 반려
export type CaseStatus = "not_started" | "in_progress" | "submitted" | "returned"

export type EvaluationCase = {
  id: number // 평가 건 번호
  targetNo: string // 평가 대상
  evaluatorNo: string // 평가자
  stage: StageKey // 자기 / 팀장 / 임원 / 상향 / 임원 상향
  status: CaseStatus
  opinion: string // 종합 의견 (제출할 때 필수, 자기평가엔 없음)
  submittedAt: string | null // 제출 시각
}

// 직군: 생산 부서 = 생산직, 경영기획부·영업부 = 관리직 (supabase/seed/02_employees.sql과 같은 규칙)
export const jobGroupOf = (person: Person) =>
  person.department === "생산" ? "production" : "office"

// 이 평가 건에 쓰는 문항 세트: 상향·임원 상향은 상향 세트, 나머지는 대상의 직군 × 역할
export function questionSetOf(item: EvaluationCase): QuestionSet {
  if (item.stage === "upward" || item.stage === "exec_upward") return "upward"
  const target = findPerson(item.targetNo)
  const role = target?.role === "leader" ? "leader" : "member"
  return target ? `${jobGroupOf(target)}_${role}` : `office_${role}`
}

// 문항 세트를 평가표 순서(분야 → 평정요소 → 문항)대로. sortOrder가 평가표 순서다.
export const questionsOf = (item: EvaluationCase) =>
  questions
    .filter((question) => question.questionSet === questionSetOf(item))
    .sort((a, b) => a.sortOrder - b.sortOrder)

// 서술형 화면 (10-데이터설계 계산 규칙 2)
// self: 서술 + 자기 점수 / score: 대상의 서술을 보고 최종 점수 입력 (바로 위 평가자) / read: 읽기만 / none: 서술형 없음
export type EssayMode = "self" | "score" | "read" | "none"

export function essayModeOf(item: EvaluationCase): EssayMode {
  if (item.stage === "upward" || item.stage === "exec_upward") return "none"
  if (item.stage === "self") return "self"
  const target = findPerson(item.targetNo)
  // 바로 위 평가자: 팀원 → 팀장, 팀장 → 임원
  const direct =
    (target?.role === "member" && item.stage === "leader") ||
    (target?.role === "leader" && item.stage === "executive")
  return direct ? "score" : "read"
}

// 미리보기 세 사람이 평가자인 건은 기본 "작성 전", 다른 사람의 건은 기본 "제출".
// 아래 표에 적은 건만 상태를 바꾼다. 키: 단계:대상:평가자
const previewEvaluators = new Set(["900011", "900010", "900028"])

const statusOverrides: Record<string, CaseStatus> = {
  // 다른 팀원들의 자기평가 (팀장 화면의 "전 단계 완료" 표시용)
  "self:900013:900013": "not_started",
  "self:900020:900020": "returned",
  "self:900024:900024": "in_progress",
  // 김민수(팀원): 자기평가·상향 평가 모두 작성 전 (발표 1번 장면)
  // 박서준(팀장): 자기평가 작성 중, 팀원 평가 일부 진행
  "self:900010:900010": "in_progress",
  "leader:900012:900010": "submitted",
  "leader:900014:900010": "submitted",
  "leader:900015:900010": "returned",
  "leader:900016:900010": "in_progress",
  "leader:900017:900010": "submitted",
  // 이정호(임원, 생산): 생산 일부 진행
  "executive:900012:900028": "submitted",
  "executive:900014:900028": "submitted",
  "executive:900016:900028": "in_progress",
  "executive:900010:900028": "returned",
  "executive:900018:900028": "submitted",
}

// 평가 건 목록: 서버 규칙(rule_relations_base)과 같은 규칙
// 자기: 팀원·팀장 각자 / 팀장: 팀원마다 같은 부서 팀장 / 임원: 같은 부서 임원(없으면 직급이 가장 높은 임원)
// 상향: 팀장마다 같은 부서 팀원 각자 / 임원 상향: 임원마다 그 임원이 평가하는 팀원·팀장 각자
function buildCases(): EvaluationCase[] {
  const targets = people.filter(
    (person) => person.role === "member" || person.role === "leader",
  )
  const executives = people.filter((person) => person.role === "executive")
  const rank = (position: string) => positions.indexOf(position)
  const topExecutive = [...executives].sort(
    (a, b) => rank(b.position) - rank(a.position) || a.employeeNo.localeCompare(b.employeeNo),
  )[0]
  const executiveOf = (department: string) =>
    executives.find((person) => person.department === department) ?? topExecutive
  const leaderOf = (department: string) =>
    people.find(
      (person) => person.department === department && person.role === "leader",
    )

  const pairs: { targetNo: string; evaluatorNo: string; stage: StageKey }[] = []
  for (const target of targets) {
    pairs.push({ targetNo: target.employeeNo, evaluatorNo: target.employeeNo, stage: "self" })
    const leader = leaderOf(target.department)
    if (target.role === "member" && leader) {
      pairs.push({ targetNo: target.employeeNo, evaluatorNo: leader.employeeNo, stage: "leader" })
    }
    const executive = executiveOf(target.department)
    if (executive) {
      pairs.push({ targetNo: target.employeeNo, evaluatorNo: executive.employeeNo, stage: "executive" })
    }
    if (target.role === "leader") {
      for (const member of targets) {
        if (member.department === target.department && member.role === "member") {
          pairs.push({ targetNo: target.employeeNo, evaluatorNo: member.employeeNo, stage: "upward" })
        }
      }
    }
  }

  for (const executive of executives) {
    for (const member of targets) {
      if (executiveOf(member.department)?.employeeNo === executive.employeeNo) {
        pairs.push({ targetNo: executive.employeeNo, evaluatorNo: member.employeeNo, stage: "exec_upward" })
      }
    }
  }

  return pairs.map((pair, index) => {
    const id = index + 1
    const status =
      statusOverrides[`${pair.stage}:${pair.targetNo}:${pair.evaluatorNo}`] ??
      (previewEvaluators.has(pair.evaluatorNo) ? "not_started" : "submitted")
    const wasSubmitted = status === "submitted" || status === "returned"
    return {
      id,
      ...pair,
      status,
      opinion: wasSubmitted ? opinions[id % opinions.length] : "",
      submittedAt: wasSubmitted ? `2026-10-${String(20 + (id % 8)).padStart(2, "0")}T10:00` : null,
    }
  })
}

// ---------- 답 (answers) ----------

export type Answer = {
  caseId: number
  questionId: number
  score: number | null // 객관식 1~5 / 서술형 0~배점
  essay: string | null // 서술 내용 (자기평가 서술형만)
}

// 가짜 서술 내용과 종합 의견 (실제 사람의 내용이 아니다)
const essays = [
  "상반기 설비 점검 순서를 정리해 정비 대기 시간을 줄였습니다. 신입 사원 작업 교육을 맡아 진행했습니다.",
  "거래처 요청 사항을 한곳에 모아 관리해 답변 시간을 줄였습니다. 월간 보고서 양식을 정리했습니다.",
  "작업 표준서를 새로 고쳐 불량을 줄이는 데 힘썼습니다. 안전 점검표를 매주 확인했습니다.",
  "부서 일정표를 만들어 회의 준비 시간을 줄였습니다. 새 업무 도구 사용법을 팀에 안내했습니다.",
]

const opinions = [
  "맡은 일을 꾸준하고 정확하게 처리했습니다.",
  "동료와 협업이 원활하며 일정 관리를 잘했습니다.",
  "개선 아이디어를 적극적으로 내고 실행했습니다.",
]

// 제출·반려 건은 모든 문항, 작성 중 건은 앞쪽 절반만 답이 있다. 작성 전 건은 답이 없다.
function buildAnswers(cases: EvaluationCase[]): Answer[] {
  return cases.flatMap((item) => {
    const list = questionsOf(item)
    const mode = essayModeOf(item)
    const answered =
      item.status === "submitted" || item.status === "returned"
        ? list.length
        : item.status === "in_progress"
          ? Math.ceil(list.length / 2)
          : 0
    return list.slice(0, answered).flatMap((question): Answer[] => {
      if (question.type === "choice") {
        // 3~5점을 고르게 섞는다
        const score = 3 + ((item.id * 7 + question.id) % 3)
        return [{ caseId: item.id, questionId: question.id, score, essay: null }]
      }
      // 서술형: 자기평가는 서술 + 자기 점수, 바로 위 평가자는 최종 점수만, 그 밖은 답 없음(읽기만)
      if (mode === "self") {
        const score = question.factorPoints - (item.id % 3)
        return [{ caseId: item.id, questionId: question.id, score, essay: essays[item.id % essays.length] }]
      }
      if (mode === "score") {
        const score = question.factorPoints - ((item.id + 1) % 3)
        return [{ caseId: item.id, questionId: question.id, score, essay: null }]
      }
      return []
    })
  })
}

export const evaluationCases: EvaluationCase[] = buildCases()
export const evaluationAnswers: Answer[] = buildAnswers(evaluationCases)

// ---------- 반려 사유 (my_return_reason) ----------

// 서버 함수 my_return_reason(평가 건 번호)은 그 건의 최근 반려 사유 글자 하나를 돌려준다 (없으면 null).
// 그래서 가짜 데이터도 평가 건 번호 → 사유 글자로 둔다. 키: 단계:대상:평가자 (위 statusOverrides의 반려 건)
const returnReasonByKey: Record<string, string> = {
  "self:900020:900020": "주요 활동 내용이 비어 있습니다.",
  "leader:900015:900010": "종합 의견에 근거를 한두 줄 더 적어 주세요.",
  "executive:900004:900028": "서술형 최종 점수를 다시 확인해 주세요.",
}

export const returnReasons: Record<number, string> = Object.fromEntries(
  evaluationCases.flatMap((item) => {
    const reason = returnReasonByKey[`${item.stage}:${item.targetNo}:${item.evaluatorNo}`]
    return reason ? [[item.id, reason]] : []
  }),
)

// ---------- 만족도 제출 여부 (docs/12-평가작성추가.md) ----------
// 자기관찰은 11/2에 화면에서 뺐다 (서버 표 self_observations는 그대로 둔다).

// 자기평가를 이미 제출(또는 제출 후 반려)한 사람은 만족도 제출을 마친 것으로 둔다.
// (임시 결정 2: 만족도를 내야 자기평가를 제출할 수 있다)
const finishedSelf = evaluationCases.filter(
  (item) => item.stage === "self" && (item.status === "submitted" || item.status === "returned"),
)

// 만족도 제출 여부 (satisfaction_done 표). 만족도 내용(점수·의견)은 작성자 없이 저장되므로 여기 두지 않는다
export const satisfactionDone: string[] = finishedSelf.map((item) => item.targetNo)
