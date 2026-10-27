import { Check, ClipboardCheck, Eye } from "lucide-react"
import { type IconType } from "./types"

// 시안의 기능 설명 카드 (페이지 담당자 참고용)
export type DetailCard = {
  label: string
  details: string[]
  status?: "보류" | "차후 연결"
}

export type DetailPage = {
  area: "참여자 영역" | "관리자 영역"
  title: string
  description: string
  icon: IconType
  cards: DetailCard[]
  // 문항 편집 페이지의 우측 상단 미리보기 버튼
  showPreview?: boolean
}

// 아직 만들지 않은 페이지의 공통 모양: 제목 / 한 줄 설명 / "준비 중" 표시 + 설명 카드
function PagePlaceholder({ page }: { page: DetailPage }) {
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
        <section className="detail-content">
          <div className="detail-content-header">
            <div>
              <div
                className="detail-content-title"
                role="heading"
                aria-level={2}
              >
                기능 설명
              </div>
              <span className="detail-status pending">준비 중</span>
            </div>
            {page.showPreview && (
              <button className="preview-button" type="button">
                <Eye size={20} />
                <span>미리보기</span>
              </button>
            )}
          </div>

          <div className="detail-layout">
            <div className="detail-cards">
              {page.cards.map((card) => (
                <div className="feature-summary" key={card.label}>
                  <div className="summary-label">
                    <span>{card.label}</span>
                    {card.status && (
                      <span
                        className={`detail-status ${
                          card.status === "보류" ? "pending" : ""
                        }`}
                      >
                        {card.status}
                      </span>
                    )}
                  </div>
                  <ul>
                    {card.details.map((detail) => (
                      <li key={detail}>
                        <Check size={18} />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardCheck size={34} strokeWidth={1.5} />
              </div>
              <strong>준비 중입니다</strong>
              <p>이 페이지는 아직 만들어지지 않았습니다.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default PagePlaceholder
