import { useState } from "react"
import {
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Database,
  Download,
  FileBarChart,
  FilePenLine,
  Gauge,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react"
import BrandMark from "@/layout/BrandMark"
import PagePlaceholder from "@/layout/PagePlaceholder"
import { type IconType } from "@/layout/types"
import { participantProfiles, type UserRole } from "@/data/participants"
import { detailPages } from "@/data/detailPages"
import Login from "@/pages/login/Login"
import MyEvaluations from "@/pages/my-evaluations/MyEvaluations"
import MyResults from "@/pages/my-results/MyResults"
import AdminDashboard from "@/pages/admin-dashboard/AdminDashboard"

const participantMenu = [
  { label: "평가 목록", icon: ClipboardCheck },
  { label: "평가 결과 내보내기", icon: Download },
]

const adminMenu = [
  { label: "대시보드", icon: LayoutDashboard },
  { label: "사람·조직", icon: UsersRound },
  { label: "평가 설계", icon: FilePenLine },
  { label: "진행 관리", icon: Gauge },
  { label: "점수·보정", icon: BarChart3 },
  { label: "리포트", icon: FileBarChart },
  { label: "면담 지원 AX", icon: Sparkles },
  { label: "데이터 관리", icon: Database },
]

function NavItem({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  label: string
  icon: IconType
  active: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      type="button"
      onClick={onClick}
    >
      <Icon size={23} strokeWidth={1.8} />
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  )
}

function App() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [activeMenu, setActiveMenu] = useState("대시보드")
  const [languageOpen, setLanguageOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickMessage, setQuickMessage] = useState("")

  const selectMenu = (label: string) => {
    setActiveMenu(label)
    setMobileMenuOpen(false)
  }

  const runQuickAction = (label: string) => {
    setQuickMessage(`${label} 메뉴로 이동할 준비가 되었습니다.`)
    setActiveMenu(
      label === "평가 작성"
        ? "평가 작성"
        : label === "응답 현황"
          ? "진행 관리"
          : "대시보드",
    )
  }

  const login = (nextRole: UserRole) => {
    setRole(nextRole)
    setActiveMenu(nextRole === "admin" ? "대시보드" : "평가 목록")
  }

  const logout = () => {
    setRole(null)
    setActiveMenu("대시보드")
    setLanguageOpen(false)
    setMobileMenuOpen(false)
  }

  if (!role) {
    return <Login onLogin={login} />
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <div className="brand-name">ROLLENT</div>
            <div className="brand-company">대양롤랜트㈜</div>
          </div>
          <button
            className="sidebar-close"
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMobileMenuOpen(false)}
          >
            <PanelLeftClose size={24} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="주 메뉴">
          {role !== "admin" ? (
            <>
              <div className="nav-section-label">참여자 영역</div>
              {participantMenu.map((item) => (
                <NavItem
                  key={item.label}
                  {...item}
                  active={activeMenu === item.label}
                  onClick={() => selectMenu(item.label)}
                />
              ))}
            </>
          ) : (
            <>
              <div className="nav-section-label">
                관리자 영역
                <span>관리자</span>
              </div>
              {adminMenu.map((item) => (
                <NavItem
                  key={item.label}
                  {...item}
                  active={activeMenu === item.label}
                  onClick={() => selectMenu(item.label)}
                />
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-language">
          <button
            type="button"
            onClick={() => setLanguageOpen((open) => !open)}
            aria-expanded={languageOpen}
          >
            <Globe2 size={22} />
            <span>한국어</span>
            <ChevronDown size={19} />
          </button>
          {languageOpen && (
            <div className="language-popover">
              <button type="button" onClick={() => setLanguageOpen(false)}>
                <Check size={17} /> 한국어
              </button>
              <button type="button" onClick={() => setLanguageOpen(false)}>
                Кыргызча
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            type="button"
            aria-label="주 메뉴 열기"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={25} />
          </button>
          <div className="page-name">
            <span>{role === "admin" ? "관리자 영역" : "참여자 영역"}</span>
            <strong>{activeMenu}</strong>
          </div>
          <label className="search-box">
            <Search size={21} />
            <input
              type="search"
              placeholder="메뉴를 검색해보세요"
              aria-label="메뉴 검색"
            />
          </label>
          <div className="top-actions">
            <button type="button" className="header-action">
              <CircleHelp size={21} />
              <span>고객지원</span>
            </button>
            <button type="button" className="icon-button" aria-label="알림">
              <Bell size={22} />
              <span className="notification-dot" />
            </button>
            <button
              type="button"
              className="header-action logout-button"
              onClick={logout}
            >
              <LogOut size={21} />
              <span>로그아웃</span>
            </button>
            <button type="button" className="user-menu">
              <span className="avatar">
                {role === "admin" ? "관" : participantProfiles[role].avatar}
              </span>
              <span className="user-info">
                <strong>
                  {role === "admin" ? "관리자" : participantProfiles[role].name}
                </strong>
                <small>
                  {role === "admin"
                    ? "관리자"
                    : participantProfiles[role].department}
                </small>
              </span>
              <ChevronDown size={18} />
            </button>
          </div>
        </header>

        <main className="dashboard">
          {quickMessage && (
            <button
              className="toast"
              type="button"
              onClick={() => setQuickMessage("")}
            >
              <Check size={19} />
              {quickMessage}
              <span>닫기</span>
            </button>
          )}

          {role !== "admin" ? (
            activeMenu === "평가 목록" ? (
              <MyEvaluations participantRole={role} />
            ) : (
              <MyResults />
            )
          ) : activeMenu === "대시보드" ? (
            <AdminDashboard
              onSelectMenu={selectMenu}
              onQuickAction={runQuickAction}
            />
          ) : (
            <PagePlaceholder key={activeMenu} page={detailPages[activeMenu]} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
