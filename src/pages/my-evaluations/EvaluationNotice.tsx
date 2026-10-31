import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { guideStep, warningStep } from "@/data/my-evaluations-notice"

// "평가하기"를 누르면 뜨는 팝업. 안내문 → 작성 전 경고 2단계를 "다음"으로 넘기고,
// 마지막에 "확인했습니다"를 눌러야 작성 화면으로 간다. 닫으면 목록에 남는다.
const steps = [guideStep, warningStep]

function EvaluationNotice({
  periodText,
  onClose,
  onConfirm,
}: {
  periodText: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [stepIndex, setStepIndex] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const step = steps[stepIndex]
  const last = stepIndex === steps.length - 1

  // 단계가 바뀔 때마다 아래 버튼에 초점을 둬서 Enter로 넘길 수 있게 한다
  useEffect(() => {
    nextRef.current?.focus()
  }, [stepIndex])

  return (
    <div className="my-evaluations-dialog-backdrop" onClick={onClose}>
      <div
        className="my-evaluations-dialog my-evaluations-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="my-evaluations-notice-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onClose()}
      >
        <div className="my-evaluations-notice-top">
          <span className="my-evaluations-notice-step">{`${stepIndex + 1} / ${steps.length}`}</span>
          <button type="button" className="my-evaluations-notice-close" aria-label="닫기" onClick={onClose}>
            <X size={26} />
          </button>
        </div>
        <strong id="my-evaluations-notice-title">{step.title}</strong>
        <dl className="my-evaluations-notice-list">
          {step.items.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.text.replace("{기간}", periodText)}</dd>
            </div>
          ))}
        </dl>
        <div className="my-evaluations-notice-actions">
          <button
            type="button"
            ref={nextRef}
            className="my-evaluations-form-submit"
            onClick={() => (last ? onConfirm() : setStepIndex(stepIndex + 1))}
          >
            {last ? "확인했습니다" : "다음"}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EvaluationNotice
