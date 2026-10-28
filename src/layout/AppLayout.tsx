import { useState, type ReactNode } from "react"
import Sidebar from "./Sidebar"
import Topbar from "./Topbar"
import { type UserRole } from "@/data/participants"
import { type AppRoute } from "@/routes"

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
          onOpenMenu={() => setMobileMenuOpen(true)}
          onLogout={onLogout}
        />

        <main className="dashboard" key={current.path}>
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
