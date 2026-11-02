import { type ReactNode } from "react"
import {
  BarChart3,
  ClipboardCheck,
  Database,
  Download,
  FileBarChart,
  FilePenLine,
  Gauge,
  LayoutDashboard,
  UsersRound,
} from "lucide-react"
import { type IconType } from "@/layout/types"
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
import ProgressReturns from "@/pages/progress-returns/ProgressReturns"
import ScoresResults from "@/pages/scores-results/ScoresResults"
import ScoresKpi from "@/pages/scores-kpi/ScoresKpi"
import ScoresAdjust from "@/pages/scores-adjust/ScoresAdjust"
import Reports from "@/pages/reports/Reports"
import ReportsAll from "@/pages/reports/ReportsAll"
import ReportsHome from "@/pages/reports/ReportsHome"
import Data from "@/pages/data/Data"

// 페이지 주소 목록. 페이지를 추가할 때 이 목록에 한 줄을 추가한다.
// 사이드바 메뉴도 이 목록을 읽어서 그린다. 메뉴 순서 = 이 목록의 줄 순서.
//
// 칸 설명
// - path: 페이지 주소
// - access: 볼 수 있는 사람 (guest: 로그인 전 / participant: 팀원·팀장·임원 / admin: 관리자)
// - menu: 사이드바 상위 메뉴 이름. 현재 페이지 강조의 기준이다.
// - menuIcon: 상위 메뉴 아이콘. 같은 메뉴에 서로 다른 아이콘이 적혀 있으면
//             그 메뉴가 처음 나오는 줄의 아이콘을 쓴다.
// - subMenu: 하위 메뉴 이름 (선택). 없으면 상위 메뉴 자체가 이 페이지로 가는 링크가 된다.
// - hideInSidebar: true면 사이드바에 보이지 않는다 (선택).
// - title: 상단바에 보일 페이지 이름
// - render: 보여 줄 페이지

export type RouteAccess = "guest" | "participant" | "admin"

export type PageContext = {
  role: UserRole | null
  login: (role: UserRole, serverName?: string) => void
  showMessage: (label: string) => void
}

export type AppRoute = {
  path: string
  access: RouteAccess
  menu: string
  menuIcon?: IconType
  subMenu?: string
  hideInSidebar?: boolean
  title: string
  render: (context: PageContext) => ReactNode
}

export const routes: AppRoute[] = [
  { path: "/login", access: "guest", menu: "", hideInSidebar: true, title: "로그인", render: ({ login }) => <Login onLogin={login} /> },

  { path: "/my/evaluations", access: "participant", menu: "평가 목록", menuIcon: ClipboardCheck, title: "평가 목록", render: ({ role }) => <MyEvaluations participantRole={role as ParticipantRole} /> },
  { path: "/my/results", access: "participant", menu: "내 평가 결과", menuIcon: Download, title: "내 평가 결과", render: () => <MyResults /> },

  { path: "/admin", access: "admin", menu: "대시보드", menuIcon: LayoutDashboard, title: "대시보드", render: ({ showMessage }) => <AdminDashboard onQuickAction={showMessage} /> },
  { path: "/admin/people/org-chart", access: "admin", menu: "사람·조직", menuIcon: UsersRound, subMenu: "조직도", title: "조직도", render: () => <PeopleOrgChart /> },
  { path: "/admin/people/relations", access: "admin", menu: "사람·조직", menuIcon: UsersRound, subMenu: "평가 관계", title: "평가 관계", render: () => <PeopleRelations /> },
  { path: "/admin/design/list", access: "admin", menu: "평가 설계", menuIcon: FilePenLine, subMenu: "평가 목록", title: "평가 목록", render: () => <DesignList /> },
  { path: "/admin/design/questions", access: "admin", menu: "평가 설계", menuIcon: FilePenLine, subMenu: "문항 편집", title: "문항 편집", render: () => <DesignQuestions /> },
  { path: "/admin/design/questions/self", access: "admin", menu: "평가 설계", menuIcon: FilePenLine, subMenu: "문항 편집", hideInSidebar: true, title: "자기평가 문항", render: () => <DesignQuestionsSelf /> },
  { path: "/admin/design/questions/member", access: "admin", menu: "평가 설계", menuIcon: FilePenLine, subMenu: "문항 편집", hideInSidebar: true, title: "팀원평가 문항", render: () => <DesignQuestionsMember /> },
  { path: "/admin/design/questions/leader", access: "admin", menu: "평가 설계", menuIcon: FilePenLine, subMenu: "문항 편집", hideInSidebar: true, title: "팀장평가 문항", render: () => <DesignQuestionsLeader /> },
  { path: "/admin/progress", access: "admin", menu: "진행 관리", menuIcon: Gauge, subMenu: "응답 현황", title: "응답 현황", render: () => <Progress /> },
  { path: "/admin/progress/returns", access: "admin", menu: "진행 관리", menuIcon: Gauge, subMenu: "반려 현황", title: "반려 현황", render: () => <ProgressReturns /> },
  { path: "/admin/scores/results", access: "admin", menu: "점수·보정", menuIcon: BarChart3, subMenu: "평가 결과", title: "평가 결과", render: () => <ScoresResults /> },
  { path: "/admin/scores/kpi", access: "admin", menu: "점수·보정", menuIcon: BarChart3, subMenu: "KPI 반영", title: "KPI 반영", render: () => <ScoresKpi /> },
  { path: "/admin/scores/adjust", access: "admin", menu: "점수·보정", menuIcon: BarChart3, subMenu: "최종 점수 보정", title: "최종 점수 보정", render: () => <ScoresAdjust /> },
  { path: "/admin/reports", access: "admin", menu: "리포트", menuIcon: FileBarChart, title: "리포트", render: () => <ReportsHome /> },
  { path: "/admin/reports/personal", access: "admin", menu: "리포트", menuIcon: FileBarChart, hideInSidebar: true, title: "개인 리포트", render: () => <Reports /> },
  { path: "/admin/reports/all", access: "admin", menu: "리포트", menuIcon: FileBarChart, hideInSidebar: true, title: "전체 리포트", render: () => <ReportsAll /> },
  { path: "/admin/data", access: "admin", menu: "데이터 관리", menuIcon: Database, title: "데이터 관리", render: () => <Data /> },
]
