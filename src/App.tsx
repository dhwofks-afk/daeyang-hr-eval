import { useState } from "react"
import { BrowserRouter, Navigate, useLocation, useNavigate } from "react-router"
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
import { type IconType } from "@/layout/types"
import { participantProfiles, type UserRole } from "@/data/participants"
import { routes, type PageContext, type RouteAccess } from "@/routes"

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

// 프로토타입 전용: 역할 미리보기로 고른 역할을 새로고침 후에도 기억한다.
// 실제 로그인 단계에서 서버 확인으로 교체한다.
const ROLE_STORAGE_KEY = "previewRole"
const userRoles: UserRole[] = ["member", "leader", "executive", "admin"]

function loadPreviewRole(): UserRole | null {
  try {
    const saved = sessionStorage.getItem(ROLE_STORAGE_KEY)
    return userRoles.find((role) => role === saved) ?? null
  } catch {
    return null
  }
}

function savePreviewRole(role: UserRole | null) {
  try {
    if (role) sessionStorage.setItem(ROLE_STORAGE_KEY, role)
    else sessionStorage.removeItem(ROLE_STORAGE_KEY)
  } catch {
    // 저장이 막힌 브라우저에서는 새로고침 시 로그인 화면으로 돌아간다.
  }
}

const homePath = (role: UserRole | null) =>
  role === null ? "/login" : role === "admin" ? "/admin" : "/my/evaluations"

const canAccess = (access: RouteAccess, role: UserRole | null) =>
  access === "guest"
    ? role === null
    : access === "admin"
      ? role === "admin"
      : role !== null && role !== "admin"

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

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole | null>(loadPreviewRole)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickMessage, setQuickMessage] = useState("")

  // 사이드바 메뉴는 그 메뉴에 속한 첫 번째 주소로 이동한다.
  const selectMenu = (label: string) => {
    const target = routes.find((route) => route.menu === label)
    if (target) navigate(target.path)
    setMobileMenuOpen(false)
  }

  const login = (nextRole: UserRole) => {
    setRole(nextRole)
    savePreviewRole(nextRole)
    navigate(homePath(nextRole))
  }

  const logout = () => {
    setRole(null)
    savePreviewRole(null)
    setLanguageOpen(false)
    setMobileMenuOpen(false)
    navigate("/login")
  }

  const context: PageContext = {
    role,
    login,
    showMessage: (label) =>
      setQuickMessage(`${label} 메뉴로 이동할 준비가 되었습니다.`),
  }

  // 없는 주소이거나 권한이 없으면 자기 역할의 첫 페이지로 보낸다.
  const current = routes.find((route) => route.path === location.pathname)
  if (!current || !canAccess(current.access, role)) {
    return <Navigate to={homePath(role)} replace />
  }

  if (!role) {
    return current.render(context)
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
                  active={current.menu === item.label}
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
                  active={current.menu === item.label}
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
            <strong>{current.title}</strong>
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

        <main className="dashboard" key={current.path}>
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

          {current.render(context)}
        </main>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
