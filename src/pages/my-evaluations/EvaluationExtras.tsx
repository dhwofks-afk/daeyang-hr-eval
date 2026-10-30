// 자기평가 작성 화면 끝에 붙는 자기관찰 · 건의 · 만족도 (docs/12-평가작성추가.md).
// 자기평가 건에서만 보인다. 평가 의견 아래, [임시 저장][제출] 버튼 위에 놓는다.
import { useState } from "react"
import { Check, EyeOff, Lock } from "lucide-react"
import {
  departmentNames,
  extrasBlockedReason,
  hasSubmittedSatisfaction,
  observationDraftOf,
  observationLocked,
  observationProblems,
  saveSelfObservation,
  selfObservationOf,
  sendSuggestion,
  submitSatisfaction,
  useEvaluationStore,
  type ObservationDraft,
  type ObservationScoreKey,
} from "./evaluation-store"

export const observationElementId = "my-evaluations-extra-observation"
export const satisfactionElementId = "my-evaluations-extra-satisfaction"

// 점수 뜻과 이동 희망 문구는 회사 확인 중이라 임시 문구를 쓴다 (docs/12 9번)
// 서버 칸 satisfaction은 아래 만족도 설문과 헷갈리지 않게 화면에서 "업무 만족도"로 보여 준다
const scoreItems: { key: Exclude<ObservationScoreKey, "transferWish">; label: string }[] = [
  { key: "workload", label: "업무량" },
  { key: "difficulty", label: "난이도" },
  { key: "aptitude", label: "적성" },
  { key: "satisfaction", label: "업무 만족도" },
  { key: "relationships", label: "대인관계" },
]

const transferOptions = [
  { value: 1, label: "원하지 않음" },
  { value: 2, label: "고려 중" },
  { value: 3, label: "희망" },
  { value: 4, label: "적극 희망" },
]

function PendingBadge() {
  return <span className="my-evaluations-extra-pending">회사 확인 중</span>
}

// ---------- 자기관찰 (필수, 본인과 관리자만) ----------

export function SelfObservationSection({
  employeeNo,
  resultPublished,
  highlight = false,
}: {
  employeeNo: string
  resultPublished: boolean // scores-store의 결과 공개 여부 (진행 관리와 같은 기준)
  highlight?: boolean // 자기평가 [제출]을 눌렀는데 아직 저장하지 않았을 때
}) {
  const store = useEvaluationStore()
  // 평가 중이 아니거나 결과 공개 후면 그 이유
  const blocked = extrasBlockedReason(resultPublished, "고칠")
  const [draft, setDraft] = useState<ObservationDraft>(() => observationDraftOf(store, employeeNo))
  const [showMissing, setShowMissing] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  // 자기평가를 제출하면 읽기 전용 (임시 결정 3). 반려되면 다시 고칠 수 있다
  const locked = observationLocked(store, employeeNo)
  const disabled = locked || blocked !== null
  const saved = Boolean(selfObservationOf(store, employeeNo))
  const problems = observationProblems(draft)
  const missingKeys = new Set(showMissing ? problems.missingScores : [])

  const change = (patch: Partial<ObservationDraft>) => {
    setMessage(null)
    setDraft((current) => ({ ...current, ...patch }))
  }

  const save = () => {
    const result = saveSelfObservation(employeeNo, draft, resultPublished)
    setShowMissing(!result.ok)
    setMessage(result.ok ? { ok: true, text: "자기관찰을 저장했습니다." } : { ok: false, text: result.message })
  }

  const scoreRow = (
    key: ObservationScoreKey,
    label: string,
    options: { value: number; label?: string }[],
    pending = false,
  ) => (
    <div
      key={key}
      className={`my-evaluations-extra-item ${missingKeys.has(key) ? "my-evaluations-form-missing" : ""}`}
    >
      <span className="my-evaluations-extra-label">
        {label}
        {pending && <PendingBadge />}
      </span>
      <div
        className={key === "transferWish" ? "my-evaluations-extra-transfer" : "my-evaluations-form-choices"}
        role="radiogroup"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={draft[key] === option.value}
            disabled={disabled}
            onClick={() => change({ [key]: option.value })}
          >
            {option.label ? `${option.value} ${option.label}` : option.value}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <section
      id={observationElementId}
      className={`my-evaluations-form-field my-evaluations-extra ${highlight ? "my-evaluations-form-missing" : ""}`}
    >
      <div className="my-evaluations-extra-heading">
        <h2>자기관찰 (필수)</h2>
        <span className={`my-evaluations-extra-state ${saved ? "my-evaluations-extra-state-done" : ""}`}>
          {saved ? "저장됨" : "저장 전"}
        </span>
      </div>
      <p className="my-evaluations-extra-note">
        <Lock size={17} />
        본인과 관리자만 볼 수 있습니다. 팀장·임원은 볼 수 없습니다.
      </p>
      {highlight && (
        <p className="my-evaluations-form-missing-text">
          자기관찰을 저장해야 자기평가를 제출할 수 있습니다.
        </p>
      )}
      {locked && (
        <p className="my-evaluations-extra-note">자기평가를 제출해 자기관찰은 읽기 전용입니다.</p>
      )}
      {!locked && blocked && <p className="my-evaluations-extra-note">{blocked}</p>}

      <div className="my-evaluations-extra-scale">
        <span>1 매우 낮음 ~ 5 매우 높음</span>
        <PendingBadge />
      </div>
      {scoreItems.map((item) =>
        scoreRow(item.key, item.label, [1, 2, 3, 4, 5].map((value) => ({ value }))),
      )}

      {scoreRow("transferWish", "이동 희망", transferOptions, true)}

      <label className="my-evaluations-extra-field">
        <span>희망 부서 (선택)</span>
        <select
          value={draft.wishDepartment ?? ""}
          disabled={disabled}
          onChange={(event) => change({ wishDepartment: event.target.value || null })}
        >
          <option value="">고르지 않음</option>
          {departmentNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label className="my-evaluations-extra-field">
        <span>현재 주요 업무 (선택)</span>
        <textarea
          className="my-evaluations-form-textarea"
          rows={2}
          value={draft.mainWork}
          disabled={disabled}
          onChange={(event) => change({ mainWork: event.target.value })}
        />
      </label>
      <label className="my-evaluations-extra-field">
        <span>기타 의견 (선택)</span>
        <textarea
          className="my-evaluations-form-textarea"
          rows={2}
          value={draft.otherOpinion}
          disabled={disabled}
          onChange={(event) => change({ otherOpinion: event.target.value })}
        />
      </label>

      {!disabled && (
        <div className="my-evaluations-extra-actions">
          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={message.ok ? "" : "my-evaluations-form-missing-text"}
            >
              {message.text}
            </p>
          )}
          <button type="button" className="my-evaluations-form-save" onClick={save}>
            자기관찰 저장
          </button>
        </div>
      )}
    </section>
  )
}

// ---------- 건의 (선택, 작성자를 알 수 없게) ----------
// 보낸 내용은 지우고 다시 보여 주지 않는다. 여러 번 보낼 수 있다 (임시 결정 7).
// 자기평가를 제출한 뒤에도 평가 중·결과 공개 전이면 보낼 수 있다.

export function SuggestionSection({ resultPublished }: { resultPublished: boolean }) {
  const [content, setContent] = useState("")
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const blocked = extrasBlockedReason(resultPublished)

  const send = () => {
    const result = sendSuggestion(content, resultPublished)
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
  const done = hasSubmittedSatisfaction(store, employeeNo)
  const blocked = extrasBlockedReason(resultPublished)

  const submit = () => {
    const result = submitSatisfaction(employeeNo, score, comment, resultPublished)
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
            <PendingBadge />
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
            <PendingBadge />
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
