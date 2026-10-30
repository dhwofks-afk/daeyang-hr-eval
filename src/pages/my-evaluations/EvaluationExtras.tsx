// 자기평가 작성 화면 끝에 붙는 자기관찰 · 건의 · 만족도 (docs/12-평가작성추가.md).
// 자기평가 건에서만 보인다. 평가 의견 아래, [임시 저장][제출] 버튼 위에 놓는다.
import { useState } from "react"
import { Lock } from "lucide-react"
import {
  departmentNames,
  extrasBlockedReason,
  observationDraftOf,
  observationLocked,
  observationProblems,
  saveSelfObservation,
  selfObservationOf,
  useEvaluationStore,
  type ObservationDraft,
  type ObservationScoreKey,
} from "./evaluation-store"

export const observationElementId = "my-evaluations-extra-observation"

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
}: {
  employeeNo: string
  resultPublished: boolean // scores-store의 결과 공개 여부 (진행 관리와 같은 기준)
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
    <section id={observationElementId} className="my-evaluations-form-field my-evaluations-extra">
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
