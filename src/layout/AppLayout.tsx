import { useState, type ReactNode } from "react"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import { useChosenCycleId } from "./CycleSelect"
import { type UserRole } from "@/data/participants"
import { type AppRoute } from "@/routes"

// 평가 선택 상자를 보이는 관리자 화면 (016): 대시보드·진행 관리·점수·리포트·건의함·만족도
// (문항 편집은 화면 안의 평가 탭으로 고른다)
const CYCLE_PAGES = ["/admin", "/admin/progress", "/admin/scores", "/admin/reports", "/admin/suggestions", "/admin/satisfaction"]
const isCyclePage = (path: string) =>
  CYCLE_PAGES.some((page) => (page === "/admin" ? path === page : path === page || path.startsWith(`${page}/`)))

// 로그인 후 모든 페이지가 쓰는 공통 틀: 사이드바 + 상단바 + 본문
function AppLayout({
  role,
  userName,
  current,
  onLogout,
  children,
}: {
  role: UserRole
  // 실제 로그인한 사람의 이름. 없으면(역할 미리보기) 가짜 데이터 이름을 보인다
  userName?: string | null
  current: AppRoute
  onLogout: () => void
  children: ReactNode
}) {
  // 좁은 화면에서 사이드바를 열고 닫는다.
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  // 평가를 바꾸면 본문을 새로 그려 그 평가를 다시 읽는다
  const chosenCycle = useChosenCycleId()
  const showCycleSelect = role === "admin" && isCyclePage(current.path)

  return (
    <div className="app-shell">
      <Sidebar
        isAdmin={role === "admin"}
        current={current}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="workspace">
        <Topbar
          role={role}
          userName={userName}
          title={current.title}
          showCycleSelect={showCycleSelect}
          onOpenMenu={() => setMobileMenuOpen(true)}
          onLogout={onLogout}
        />

        <main className="dashboard" key={`${current.path}:${chosenCycle ?? ""}`}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
