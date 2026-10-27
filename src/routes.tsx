import { type ReactNode } from "react"
import { type ParticipantRole, type UserRole } from "@/data/participants"
import Login from "@/pages/login/Login"
import MyEvaluations from "@/pages/my-evaluations/MyEvaluations"
import MyResults from "@/pages/my-results/MyResults"
import AdminDashboard from "@/pages/admin-dashboard/AdminDashboard"
import PeopleOrgChart from "@/pages/people-org-chart/PeopleOrgChart"
import PeopleRelations from "@/pages/people-relations/PeopleRelations"
import DesignList from "@/pages/design-list/DesignList"
import DesignQuestions from "@/pages/design-questions/DesignQuestions"
import DesignQuestionsSelf from "@/pages/design-questions-self/DesignQuestionsSelf"
import DesignQuestionsMember from "@/pages/design-questions-member/DesignQuestionsMember"
import DesignQuestionsLeader from "@/pages/design-questions-leader/DesignQuestionsLeader"
import Progress from "@/pages/progress/Progress"
import ScoresResults from "@/pages/scores-results/ScoresResults"
import ScoresKpi from "@/pages/scores-kpi/ScoresKpi"
import ScoresAdjust from "@/pages/scores-adjust/ScoresAdjust"
import Reports from "@/pages/reports/Reports"
import Interview from "@/pages/interview/Interview"
import Data from "@/pages/data/Data"

// guest: 로그인 전 / participant: 팀원·팀장·임원 / admin: 관리자
export type RouteAccess = "guest" | "participant" | "admin"

export type PageContext = {
  role: UserRole | null
  login: (role: UserRole) => void
  showMessage: (label: string) => void
}

export type AppRoute = {
  path: string
  access: RouteAccess
  // 사이드바에서 강조할 메뉴 이름
  menu: string
  // 상단바에 보일 페이지 이름
  title: string
  render: (context: PageContext) => ReactNode
}

// 페이지를 추가할 때 이 목록에 한 줄을 추가한다.
export const routes: AppRoute[] = [
  { path: "/login", access: "guest", menu: "", title: "로그인", render: ({ login }) => <Login onLogin={login} /> },

  { path: "/my/evaluations", access: "participant", menu: "평가 목록", title: "평가 목록", render: ({ role }) => <MyEvaluations participantRole={role as ParticipantRole} /> },
  { path: "/my/results", access: "participant", menu: "평가 결과 내보내기", title: "평가 결과 내보내기", render: () => <MyResults /> },

  { path: "/admin", access: "admin", menu: "대시보드", title: "대시보드", render: ({ showMessage }) => <AdminDashboard onQuickAction={showMessage} /> },
  { path: "/admin/people/org-chart", access: "admin", menu: "사람·조직", title: "조직도", render: () => <PeopleOrgChart /> },
  { path: "/admin/people/relations", access: "admin", menu: "사람·조직", title: "평가 관계", render: () => <PeopleRelations /> },
  { path: "/admin/design/list", access: "admin", menu: "평가 설계", title: "평가 목록", render: () => <DesignList /> },
  { path: "/admin/design/questions", access: "admin", menu: "평가 설계", title: "문항 편집", render: () => <DesignQuestions /> },
  { path: "/admin/design/questions/self", access: "admin", menu: "평가 설계", title: "자기평가 문항", render: () => <DesignQuestionsSelf /> },
  { path: "/admin/design/questions/member", access: "admin", menu: "평가 설계", title: "팀원평가 문항", render: () => <DesignQuestionsMember /> },
  { path: "/admin/design/questions/leader", access: "admin", menu: "평가 설계", title: "팀장평가 문항", render: () => <DesignQuestionsLeader /> },
  { path: "/admin/progress", access: "admin", menu: "진행 관리", title: "진행 관리", render: () => <Progress /> },
  { path: "/admin/scores/results", access: "admin", menu: "점수·보정", title: "평가 결과", render: () => <ScoresResults /> },
  { path: "/admin/scores/kpi", access: "admin", menu: "점수·보정", title: "KPI 반영", render: () => <ScoresKpi /> },
  { path: "/admin/scores/adjust", access: "admin", menu: "점수·보정", title: "최종 점수 보정", render: () => <ScoresAdjust /> },
  { path: "/admin/reports", access: "admin", menu: "리포트", title: "리포트", render: () => <Reports /> },
  { path: "/admin/interview", access: "admin", menu: "면담 지원 AX", title: "면담 지원 AX", render: () => <Interview /> },
  { path: "/admin/data", access: "admin", menu: "데이터 관리", title: "데이터 관리", render: () => <Data /> },
]
