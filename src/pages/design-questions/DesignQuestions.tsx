import { useState } from "react"
import { useNavigate } from "react-router"
import {
  ChevronRight,
  Eye,
  ListChecks,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"
import {
  currentRound,
  setSummary,
  statusClass,
  useDesignState,
} from "@/data/design"
import DesignQuestionsPreview from "./DesignQuestionsPreview"
import { setPath, setTitle, sheets, type SheetKey } from "./question-sheets"
import "./design-questions.css"

const sheetIcons: Record<SheetKey, typeof UserRound> = {
  member: UserRound,
  leader: UsersRound,
  upward: ShieldCheck,
}

function DesignQuestions() {
  const navigate = useNavigate()
  const design = useDesignState()
  const round = currentRound(design)
  const [showPreview, setShowPreview] = useState(false)

  return (
    <div className="design-questions-page">
      <div className="design-questions-heading">
        <div className="detail-heading">
          <div className="detail-heading-icon">
            <ListChecks size={30} strokeWidth={1.8} />
          </div>
          <div>
            <div className="detail-area">평가 설계</div>
            <div className="detail-title" role="heading" aria-level={1}>
              문항 편집
            </div>
            <p>평가표 5종의 문항과 배점을 확인하고 편집합니다.</p>
          </div>
        </div>
        <button type="button" className="preview-button" onClick={() => setShowPreview(true)}>
          <Eye size={19} />
          미리보기
        </button>
      </div>

      <div className="design-questions-grid">
        {sheets.map((sheet) => {
          const Icon = sheetIcons[sheet.key]
          return (
            <article className="design-questions-card" key={sheet.key}>
              <div className="design-questions-card-top">
                <span className="design-questions-card-icon">
                  <Icon size={25} />
                </span>
                <span className={`design-questions-status ${statusClass[round.status]}`}>
                  {round.status}
                </span>
              </div>
              <div>
                <strong className="design-questions-card-title">{sheet.title}</strong>
                <p className="design-questions-card-description">{sheet.description}</p>
              </div>
              <div className="design-questions-sets">
                {sheet.sets.map((set) => {
                  const { count, points } = setSummary(design.questions, set.set)
                  return (
                    <button
                      type="button"
                      key={set.set}
                      className="design-questions-set"
                      onClick={() => navigate(setPath(sheet, set))}
                      aria-label={`${setTitle(sheet, set)} 문항 편집`}
                    >
                      <span>
                        <strong>{set.label}</strong>
                        <small className={points === 100 ? "" : "wrong"}>
                          문항 {count}개 · 배점 {points}
                        </small>
                      </span>
                      <span className="design-questions-set-go">
                        문항 편집
                        <ChevronRight size={18} />
                      </span>
                    </button>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>

      {showPreview && (
        <DesignQuestionsPreview
          choices={sheets.flatMap((sheet) =>
            sheet.sets.map((set) => ({ set: set.set, title: setTitle(sheet, set) })),
          )}
          questions={design.questions}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}

export default DesignQuestions
