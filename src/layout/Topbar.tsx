import { LogOut, Menu } from "lucide-react"
import { participantProfiles, type UserRole } from "@/data/participants"

// 상단바: 사용자 이름·역할과 로그아웃만 둔다.
function Topbar({
  role,
  title,
  onOpenMenu,
  onLogout,
}: {
  role: UserRole
  title: string
  onOpenMenu: () => void
  onLogout: () => void
}) {
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
          <span className="avatar">
            {role === "admin" ? "관" : participantProfiles[role].avatar}
          </span>
          <span className="user-info">
            <strong>
              {role === "admin" ? "관리자" : participantProfiles[role].name}
            </strong>
            <small>
              {role === "admin" ? "관리자" : participantProfiles[role].title}
            </small>
          </span>
        </div>
      </div>
    </header>
  )
}

export default Topbar
