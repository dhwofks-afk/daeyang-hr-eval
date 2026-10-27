import {
  Bell,
  ChevronDown,
  CircleHelp,
  LogOut,
  Menu,
  Search,
} from "lucide-react"
import { participantProfiles, type UserRole } from "@/data/participants"

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
          onClick={onLogout}
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
  )
}

export default Topbar
