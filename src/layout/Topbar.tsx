import { LogOut, Menu } from "lucide-react"
import { participantProfiles, type UserRole } from "@/data/participants"
import CycleSelect from "./CycleSelect"

const roleLabels: Record<UserRole, string> = {
  member: "팀원",
  leader: "팀장",
  executive: "임원",
  admin: "관리자",
}

// 상단바: 사용자 이름·역할과 로그아웃만 둔다.
// 실제 로그인이면 서버에서 받은 이름(userName), 역할 미리보기면 가짜 데이터 이름을 보인다.
function Topbar({
  role,
  userName,
  title,
  showCycleSelect,
  onOpenMenu,
  onLogout,
}: {
  role: UserRole
  userName?: string | null
  title: string
  // 평가별로 보는 관리자 화면이면 평가 선택 상자를 보인다 (016)
  showCycleSelect: boolean
  onOpenMenu: () => void
  onLogout: () => void
}) {
  const user = userName
    ? { avatar: userName.charAt(0), name: userName, title: roleLabels[role] }
    : role === "admin"
      ? { avatar: "관", name: "관리자", title: "관리자" }
      : participantProfiles[role]

  return (
    <header className="topbar">
      <button
        className="mobile-menu"
        type="button"
        aria-label="주 메뉴 열기"
        onClick={onOpenMenu}
      >
        <Menu size={25} />
      </button>
      <div className="page-name">
        <span>{role === "admin" ? "관리자 영역" : "참여자 영역"}</span>
        <strong>{title}</strong>
      </div>
      {showCycleSelect && <CycleSelect />}
      <div className="top-actions">
        <button
          type="button"
          className="header-action logout-button"
          onClick={onLogout}
        >
          <LogOut size={21} />
          <span>로그아웃</span>
        </button>
        <div className="user-menu">
          <span className="avatar">{user.avatar}</span>
          <span className="user-info">
            <strong>{user.name}</strong>
            <small>{user.title}</small>
          </span>
        </div>
      </div>
    </header>
  )
}

export default Topbar
