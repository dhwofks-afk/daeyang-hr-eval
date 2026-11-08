// 문항 미리보기 창 (별도 주소 없이 창으로 띄운다). 참여자가 보는 모양을 보여 주고, 답은 저장하지 않는다.
// 문항 편집 화면과 하위 편집 화면이 함께 쓴다.
import { useState } from "react"
import { X } from "lucide-react"
import { groupQuestions } from "@/data/design"
import type { Question, QuestionSet } from "@/data/evaluations"
import "./design-questions.css"

function DesignQuestionsPreview({
  choices,
  questions,
  onClose,
}: {
  // 미리 볼 평가표. 둘 이상이면 창 위쪽에서 고른다
  choices: { set: QuestionSet; title: string }[]
  questions: Question[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState(choices[0].set)
  const choice = choices.find((item) => item.set === selected) ?? choices[0]
  const fields = groupQuestions(questions, choice.set)
  let number = 0

  return (
    <div className="design-questions-backdrop" role="presentation">
      <div
        className="design-questions-modal design-questions-preview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="design-questions-preview-title"
      >
        <div className="design-questions-preview-header">
          <div>
            <span>관리자 미리보기</span>
            <div
              id="design-questions-preview-title"
              className="design-questions-modal-title"
              role="heading"
              aria-level={2}
            >
              {choice.title}
            </div>
            <p>평가하는 사람에게 보이는 문항 모양을 확인합니다.</p>
          </div>
          <button type="button" aria-label="미리보기 닫기" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {choices.length > 1 && (
          <div className="design-questions-preview-choices" role="tablist" aria-label="평가표 고르기">
            {choices.map((item) => (
              <button
                type="button"
                role="tab"
                key={item.set}
                aria-selected={item.set === choice.set}
                className={item.set === choice.set ? "active" : ""}
                onClick={() => setSelected(item.set)}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}

        <div className="design-questions-preview-list">
          {fields.length === 0 && (
            <p className="design-questions-preview-empty">등록된 문항이 없습니다.</p>
          )}
          {fields.map((field) => (
            <section className="design-questions-preview-field" key={field.field}>
              <div className="design-questions-preview-field-title">
                {field.field} <small>{field.points}점</small>
              </div>
              {field.factors.map((factor) => (
                <div className="design-questions-preview-factor" key={factor.factor}>
                  <div className="design-questions-preview-factor-title">
                    {factor.factor} <small>{factor.points}점</small>
                  </div>
                  {factor.questions.map((question) => {
                    number += 1
                    return (
                      <div className="design-questions-preview-question" key={question.id}>
                        <span>문항 {number}</span>
                        <p>{question.content}</p>
                        {question.type === "choice" ? (
                          <>
                            <div className="design-questions-preview-scale" aria-label="5점 척도">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <button type="button" key={score}>
                                  <strong>{score}</strong>
                                </button>
                              ))}
                            </div>
                            <div className="design-questions-preview-scale-text">
                              <span>1 매우 미흡</span>
                              <span>5 매우 우수</span>
                            </div>
                          </>
                        ) : (
                          <textarea
                            aria-label={`${question.content} 답변`}
                            placeholder="답변을 입력해 주세요."
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="design-questions-preview-footer">
          <span>미리보기에서는 답변이 저장되지 않습니다.</span>
          <button type="button" className="design-questions-button primary" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

export default DesignQuestionsPreview
