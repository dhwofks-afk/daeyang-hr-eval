import { useEffect, useState } from "react"
import { BrowserRouter, Navigate, useLocation, useNavigate } from "react-router"
import { Check } from "lucide-react"
import AppLayout from "@/layout/AppLayout"
import { type UserRole } from "@/data/participants"
import { restoreProfile, signOut, supabase } from "@/lib/supabase"
import { routes, type PageContext, type RouteAccess } from "@/routes"

// 실제 로그인: 역할은 서버(my_profile)에서 받고, 새로고침하면 로그인된 계정에서 다시 받는다.
// 프로토타입 전용: 역할 미리보기로 고른 역할을 새로고침 후에도 기억한다.
// 역할 미리보기는 11/4 실제 연결 때 이 부분과 함께 제거한다.
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
  // 실제 로그인한 사람의 이름 (my_profile). 역할 미리보기면 null → 상단바는 가짜 데이터 이름
  const [serverName, setServerName] = useState<string | null>(null)
  const [quickMessage, setQuickMessage] = useState("")
  // 로그인된 계정을 확인하는 동안에는 주소를 바꾸지 않도록 아무것도 그리지 않는다.
  const [restoring, setRestoring] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    restoreProfile().then((profile) => {
      if (!active) return
      if (profile) {
        setRole(profile.role)
        setServerName(profile.name)
        savePreviewRole(null)
      }
      setRestoring(false)
    })
    return () => {
      active = false
    }
  }, [])

  // serverName: 실제 로그인이면 서버에서 받은 이름, 역할 미리보기면 없음
  const login = (nextRole: UserRole, nextServerName?: string) => {
    setRole(nextRole)
    setServerName(nextServerName ?? null)
    savePreviewRole(nextServerName === undefined ? nextRole : null)
    navigate(homePath(nextRole))
  }

  const logout = () => {
    void signOut()
    setRole(null)
    setServerName(null)
    savePreviewRole(null)
    setQuickMessage("")
    navigate("/login")
  }

  if (restoring) return null

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
    <AppLayout
      role={role}
      userName={serverName}
      current={current}
      onLogout={logout}
    >
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
