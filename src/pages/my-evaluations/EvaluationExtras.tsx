// 자기평가 작성 화면 끝에 붙는 건의 · 만족도 (docs/12-평가작성추가.md).
// 자기평가 건에서만 보인다. [임시 저장][제출] 버튼 위에 놓는다.
// 자기관찰은 11/2에 화면에서 뺐다 (서버 표 self_observations는 그대로 둔다).
import { useState } from "react"
import { Check, EyeOff } from "lucide-react"
import {
  extrasBlockedReason,
  hasSubmittedSatisfaction,
  sendSuggestion,
  submitSatisfaction,
  useEvaluationStore,
} from "./evaluation-store"

export const satisfactionElementId = "my-evaluations-extra-satisfaction"

// ---------- 건의 (선택, 작성자를 알 수 없게) ----------
// 보낸 내용은 지우고 다시 보여 주지 않는다. 여러 번 보낼 수 있다 (임시 결정 7).
// 자기평가를 제출한 뒤에도 평가 중·결과 공개 전이면 보낼 수 있다.

export function SuggestionSection({ resultPublished }: { resultPublished: boolean }) {
  const [content, setContent] = useState("")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const blocked = extrasBlockedReason(resultPublished)

  const send = async () => {
    if (busy) return
    setBusy(true)
    const result = await sendSuggestion(content, resultPublished)
    setBusy(false)
    if (result.ok) {
      setContent("")
      setMessage({ ok: true, text: "건의를 보냈습니다. 더 보낼 내용이 있으면 다시 적어 주세요." })
    } else {
      setMessage({ ok: false, text: result.message })
    }
  }

  return (
    <section className="my-evaluations-form-field my-evaluations-extra">
      <div className="my-evaluations-extra-heading">
        <h2>건의 (선택)</h2>
      </div>
      <p className="my-evaluations-extra-note">
        <EyeOff size={17} />
        작성자는 저장되지 않습니다. 보낸 뒤에는 고치거나 다시 볼 수 없습니다.
      </p>
      {blocked && <p className="my-evaluations-extra-note">{blocked}</p>}
      <textarea
        className="my-evaluations-form-textarea"
        rows={3}
        value={content}
        disabled={blocked !== null}
        aria-label="건의 내용"
        placeholder="회사에 바라는 점을 자유롭게 적어 주세요. 비워 두어도 됩니다."
        onChange={(event) => {
          setMessage(null)
          setContent(event.target.value)
        }}
      />
      {!blocked && (
        <div className="my-evaluations-extra-actions">
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={message.ok ? "" : "my-evaluations-form-missing-text"}
            >
              {message.text}
            </p>
          )}
          <button type="button" className="my-evaluations-form-save" onClick={send}>
            건의 보내기
          </button>
        </div>
      )}
    </section>
  )
}

// ---------- 만족도 (필수, 작성자를 알 수 없게, 한 번만) ----------
// 낸 뒤에는 제출 여부만 보여 주고 점수·의견은 다시 읽지 않는다.

export function SatisfactionSection({
  employeeNo,
  resultPublished,
  highlight = false,
}: {
  employeeNo: string
  resultPublished: boolean
  highlight?: boolean // 자기평가 [제출]을 눌렀는데 아직 내지 않았을 때
}) {
  const store = useEvaluationStore()
  const [score, setScore] = useState<number | null>(null)
  const [comment, setComment] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const done = hasSubmittedSatisfaction(store, employeeNo)
  const blocked = extrasBlockedReason(resultPublished)

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const result = await submitSatisfaction(employeeNo, score, comment, resultPublished)
    setBusy(false)
    if (result.ok) {
      // 보낸 점수·의견은 화면에도 남기지 않는다
      setScore(null)
      setComment("")
      setError(null)
    } else {
      setError(result.message)
    }
  }

  return (
    <section
      id={satisfactionElementId}
      className={`my-evaluations-form-field my-evaluations-extra ${highlight ? "my-evaluations-form-missing" : ""}`}
    >
      <div className="my-evaluations-extra-heading">
        <h2>만족도 (필수)</h2>
        <span className={`my-evaluations-extra-state ${done ? "my-evaluations-extra-state-done" : ""}`}>
          {done ? "제출함" : "제출 전"}
        </span>
      </div>
      {highlight && (
        <p className="my-evaluations-form-missing-text">
          만족도를 제출해야 자기평가를 제출할 수 있습니다.
        </p>
      )}
      <p className="my-evaluations-extra-note">
        <EyeOff size={17} />
        작성자는 저장되지 않습니다. 한 번만 낼 수 있습니다.
      </p>

      {done ? (
        <p className="my-evaluations-extra-done">
          <Check size={20} />
          이번 회차 만족도를 제출했습니다.
        </p>
      ) : (
        <>
          {blocked && <p className="my-evaluations-extra-note">{blocked}</p>}
          <div className="my-evaluations-extra-question">
            <span>이번 인사평가 과정에 얼마나 만족하셨나요?</span>
          </div>
          <div
            className={`my-evaluations-extra-item ${error && score === null ? "my-evaluations-form-missing" : ""}`}
          >
            <span className="my-evaluations-extra-label">점수</span>
            <div className="my-evaluations-form-choices" role="radiogroup" aria-label="만족도 점수">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={score === value}
                  disabled={blocked !== null}
                  onClick={() => {
                    setError(null)
                    setScore(value)
                  }}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="my-evaluations-extra-scale">
            <span>1 매우 불만족 ~ 5 매우 만족</span>
          </div>
          <label className="my-evaluations-extra-field">
            <span>의견 (선택)</span>
            <textarea
              className="my-evaluations-form-textarea"
              rows={2}
              value={comment}
              disabled={blocked !== null}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {!blocked && (
            <div className="my-evaluations-extra-actions">
              {error && (
                <p role="alert" className="my-evaluations-form-missing-text">
                  {error}
                </p>
              )}
              <button type="button" className="my-evaluations-form-save" onClick={submit}>
                만족도 제출
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}
