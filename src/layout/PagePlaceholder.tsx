import { useState } from "react"
import { Check, ClipboardCheck, Eye } from "lucide-react"
import { type IconType } from "./types"

export type DetailSection = {
  label: string
  details: string[]
  status?: "보류" | "차후 연결" | "자료 대기"
}

export type DetailPage = {
  area: "참여자 영역" | "관리자 영역"
  title: string
  description: string
  icon: IconType
  sections: DetailSection[]
}

function PagePlaceholder({
  page,
  initialSection,
}: {
  page: DetailPage
  // 처음에 선택해 둘 탭 이름 (없으면 첫 번째 탭)
  initialSection?: string
}) {
  const [activeSection, setActiveSection] = useState(
    initialSection ?? page.sections[0].label,
  )
  const section =
    page.sections.find((item) => item.label === activeSection) ??
    page.sections[0]
  const Icon = page.icon

  return (
    <div className="detail-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Icon size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">{page.area}</div>
          <div className="detail-title" role="heading" aria-level={1}>
            {page.title}
          </div>
          <p>{page.description}</p>
        </div>
      </div>

      <div className="detail-shell">
        <div
          className="section-tabs"
          role="tablist"
          aria-label={`${page.title} 하위 메뉴`}
        >
          {page.sections.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={section.label === item.label}
              className={section.label === item.label ? "active" : ""}
              key={item.label}
              onClick={() => setActiveSection(item.label)}
            >
              <span>{item.label}</span>
              {item.status && <small>{item.status}</small>}
            </button>
          ))}
        </div>

        <section className="detail-content" role="tabpanel">
          <div className="detail-content-header">
            <div>
              <div
                className="detail-content-title"
                role="heading"
                aria-level={2}
              >
                {section.label}
              </div>
              {section.status && (
                <span
                  className={`detail-status ${
                    section.status === "보류" ? "pending" : ""
                  }`}
                >
                  {section.status}
                </span>
              )}
            </div>
            {page.title === "평가 설계" && section.label === "문항 편집" && (
              <button className="preview-button" type="button">
                <Eye size={20} />
                <span>미리보기</span>
              </button>
            )}
          </div>

          <div className="detail-layout">
            <div className="feature-summary">
              <div className="summary-label">화면 구성</div>
              <ul>
                {section.details.map((detail) => (
                  <li key={detail}>
                    <Check size={18} />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardCheck size={34} strokeWidth={1.5} />
              </div>
              <strong>등록된 내용이 없습니다</strong>
              <p>실제 데이터가 등록되면 이 영역에 표시됩니다.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PagePlaceholder
