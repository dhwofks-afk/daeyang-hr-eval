import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { ChevronDown, Globe2, PanelLeftClose } from "lucide-react"
import BrandMark from "./BrandMark"
import { type IconType } from "./types"
import { routes, type AppRoute } from "@/routes"

type MenuGroup = {
  menu: string
  icon?: IconType
  // 하위 메뉴가 없는 메뉴가 이동할 주소
  path?: string
  subRoutes: AppRoute[]
}

// routes.tsx를 읽어 상위 메뉴별로 묶는다. 순서와 아이콘은 그 메뉴가 처음 나오는 줄을 따른다.
function buildMenuGroups(area: "participant" | "admin") {
  const groups: MenuGroup[] = []
  for (const route of routes) {
    if (route.access !== area) continue
    let group = groups.find((item) => item.menu === route.menu)
    if (!group) {
      group = { menu: route.menu, icon: route.menuIcon, subRoutes: [] }
      groups.push(group)
    }
    if (route.hideInSidebar) continue
    if (route.subMenu) group.subRoutes.push(route)
    else group.path ??= route.path
  }
  return groups.filter((group) => group.path || group.subRoutes.length > 0)
}

function NavItem({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  label: string
  icon?: IconType
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
      {Icon && <Icon size={23} strokeWidth={1.8} />}
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  )
}

function Sidebar({
  isAdmin,
  current,
  open,
  onClose,
}: {
  isAdmin: boolean
  current: AppRoute
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()
  const [openMenus, setOpenMenus] = useState<string[]>([current.menu])
  const groups = buildMenuGroups(isAdmin ? "admin" : "participant")

  // 다른 경로(대시보드 버튼 등)로 이동해도 현재 페이지의 메뉴는 펼쳐 둔다.
  useEffect(() => {
    setOpenMenus((menus) =>
      menus.includes(current.menu) ? menus : [...menus, current.menu],
    )
  }, [current.menu])

  const toggleMenu = (menu: string) =>
    setOpenMenus((menus) =>
      menus.includes(menu)
        ? menus.filter((item) => item !== menu)
        : [...menus, menu],
    )

  const goTo = (path: string) => {
    navigate(path)
    onClose()
  }

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
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
          onClick={onClose}
        >
          <PanelLeftClose size={24} />
        </button>
      </div>

      <nav className="sidebar-nav" aria-label="주 메뉴">
        {isAdmin ? (
          <div className="nav-section-label">
            관리자 영역
            <span>관리자</span>
          </div>
        ) : (
          <div className="nav-section-label">참여자 영역</div>
        )}
        {groups.map((group) => {
          const { path } = group
          if (path) {
            return (
              <NavItem
                key={group.menu}
                label={group.menu}
                icon={group.icon}
                active={current.menu === group.menu}
                onClick={() => goTo(path)}
              />
            )
          }

          const Icon = group.icon
          const expanded = openMenus.includes(group.menu)
          return (
            <div key={group.menu}>
              <button
                className="nav-item"
                type="button"
                aria-expanded={expanded}
                onClick={() => toggleMenu(group.menu)}
              >
                {Icon && <Icon size={23} strokeWidth={1.8} />}
                <span>{group.menu}</span>
                <ChevronDown className="nav-chevron" size={19} />
              </button>
              {expanded &&
                group.subRoutes.map((route) => (
                  <button
                    key={route.path}
                    className={`nav-item nav-sub-item ${
                      current.menu === group.menu &&
                      current.subMenu === route.subMenu
                        ? "active"
                        : ""
                    }`}
                    type="button"
                    onClick={() => goTo(route.path)}
                  >
                    <span>{route.subMenu}</span>
                  </button>
                ))}
            </div>
          )
        })}
      </nav>

      {/* 언어 선택: 메뉴는 보이되 아직 준비 중이라 누를 수 없다. */}
      <div className="sidebar-language">
        <button type="button" aria-disabled="true">
          <Globe2 size={22} />
          <span>한국어</span>
          <span className="nav-badge">준비 중</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
