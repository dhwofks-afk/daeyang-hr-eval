import { useState } from "react"
import { BrowserRouter, Navigate, useLocation, useNavigate } from "react-router"
import { Check } from "lucide-react"
import AppLayout from "@/layout/AppLayout"
import { type UserRole } from "@/data/participants"
import { routes, type PageContext, type RouteAccess } from "@/routes"

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

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const [role, setRole] = useState<UserRole | null>(loadPreviewRole)
  const [quickMessage, setQuickMessage] = useState("")

  const login = (nextRole: UserRole) => {
    setRole(nextRole)
    savePreviewRole(nextRole)
    navigate(homePath(nextRole))
  }

  const logout = () => {
    setRole(null)
    savePreviewRole(null)
    setQuickMessage("")
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
    <AppLayout role={role} current={current} onLogout={logout}>
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
    </AppLayout>
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
