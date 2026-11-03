import { useState } from "react"
import { Lock, Search, SlidersHorizontal } from "lucide-react"
import {
  addAdjustments,
  departmentNames,
  filterAndSort,
  personByNo,
  scoreResults,
  sortOptions,
  useScoreState,
  type SortKey,
} from "@/data/scores-store"
import "./scores-adjust.css"

// 입력 칸 글자 → 숫자. 비었으면 null(보정 없음), 숫자가 아니면 NaN
const toScore = (text: string) => (text.trim() === "" ? null : Number(text))

// 보정 기록 시각 표시: 2026-11-03T14:20:05 → 11/3 14:20
const timeText = (value: string) => {
  const [date, time = ""] = value.split("T")
  const [, month, day] = date.split("-").map(Number)
  return `${month}/${day} ${time.slice(0, 5)}`
}

function ScoresAdjust() {
  const store = useScoreState()
  const locked = store.resultPublished
  const [department, setDepartment] = useState("전체")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("department")
  // 저장 전 입력값. 고친 사람만 담는다 (없으면 저장된 보정값을 보여 준다)
  const [drafts, setDrafts] = useState<Record<string, { score: string; reason: string }>>({})
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  // 여러 명 한 번에: 체크한 사람에게 같은 보정 점수·사유를 넣는다 (저장은 아래 [저장] 한 번)
  const [checked, setChecked] = useState<string[]>([])
  const [bulkScore, setBulkScore] = useState("")
  const [bulkReason, setBulkReason] = useState("")

  const savedResults = scoreResults(store)

  // 고친 줄 → 새 보정 기록 (보정 점수가 그대로면 기록하지 않음)
  const problems: string[] = []
  const changes = Object.entries(drafts).flatMap(([employeeNo, draft]) => {
    const current = savedResults.find((result) => result.employeeNo === employeeNo)
    if (!current) return []
    const after = toScore(draft.score)
    if (after !== null && (!Number.isFinite(after) || after < 0 || after > 100)) {
      problems.push(`${personByNo.get(employeeNo)?.name}: 보정 점수는 0~100 사이 숫자로 입력해 주세요.`)
      return []
    }
    if (after === current.adjustment) return []
    return [{ employeeNo, before: current.kpiApplied, after, reason: draft.reason.trim() }]
  })

  // 저장 후 모습 미리보기 (입력값으로 다시 계산 → 보정 전·후를 나란히)
  const previewResults = scoreResults({
    ...store,
    adjustments: [
      ...store.adjustments,
      ...changes.map((change) => ({
        ...change,
        round: 0,
        adjustedBy: "관리자",
        adjustedAt: "9999",
      })),
    ],
  })
  const shown = filterAndSort(previewResults, { department, search, sort })

  const setDraft = (employeeNo: string, field: "score" | "reason", value: string) => {
    const current = savedResults.find((result) => result.employeeNo === employeeNo)
    const draft = drafts[employeeNo] ?? {
      score: current?.adjustment === null || !current ? "" : String(current.adjustment),
      reason: "",
    }
    setDrafts({ ...drafts, [employeeNo]: { ...draft, [field]: value } })
  }

  const applyBulk = () => {
    const next = { ...drafts }
    for (const employeeNo of checked) next[employeeNo] = { score: bulkScore, reason: bulkReason }
    setDrafts(next)
    setMessage({ ok: true, text: `${checked.length}명에게 넣었습니다. [저장]을 눌러야 저장됩니다.` })
  }

  const toggleChecked = (employeeNo: string) =>
    setChecked(checked.includes(employeeNo) ? checked.filter((no) => no !== employeeNo) : [...checked, employeeNo])

  const save = () => {
    if (problems.length) {
      setMessage({ ok: false, text: problems[0] })
      return
    }
    if (!changes.length) {
      setMessage({ ok: false, text: "바뀐 내용이 없습니다." })
      return
    }
    if (!addAdjustments(changes)) {
      setMessage({ ok: false, text: "결과가 확정되어 수정할 수 없습니다." })
      return
    }
    setDrafts({})
    setChecked([])
    setMessage({ ok: true, text: `저장했습니다. 보정 ${changes.length}건` })
  }

  const log = [...store.adjustments].reverse()

  return (
    <div className="scores-adjust-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <SlidersHorizontal size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            최종 점수 보정
          </div>
          <p>비율 반영 점수(보정 전 최종 점수)를 직접 조정합니다. 보정 점수를 비우고 저장하면 보정이 취소됩니다.</p>
        </div>
      </div>

      {locked && (
        <div className="scores-adjust-locked">
          <Lock size={20} />
          결과 확정됨 · 수정 불가
        </div>
      )}

      <div className="scores-adjust-filter" role="group" aria-label="부서 선택">
        {["전체", ...departmentNames].map((name) => (
          <button
            key={name}
            type="button"
            className={department === name ? "active" : ""}
            aria-pressed={department === name}
            onClick={() => setDepartment(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="scores-adjust-tools">
        <label className="scores-adjust-search">
          <Search size={20} />
          <input
            type="search"
            placeholder="이름 검색"
            aria-label="이름 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="scores-adjust-sort">
          <span>정렬</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scores-adjust-bulk">
        <strong>{`체크한 ${checked.length}명에게 한 번에`}</strong>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          aria-label="체크한 사람 보정 점수"
          placeholder="보정 점수 (비우면 취소)"
          value={bulkScore}
          disabled={locked}
          onChange={(event) => setBulkScore(event.target.value)}
        />
        <input
          type="text"
          aria-label="체크한 사람 보정 사유"
          placeholder="사유 (선택)"
          value={bulkReason}
          disabled={locked}
          onChange={(event) => setBulkReason(event.target.value)}
        />
        <button type="button" disabled={locked || !checked.length} onClick={applyBulk}>
          넣기
        </button>
      </div>

      <div className="scores-adjust-table-wrap">
        <table className="scores-adjust-table">
          <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  aria-label="보이는 사람 모두 체크"
                  checked={shown.length > 0 && shown.every((result) => checked.includes(result.employeeNo))}
                  disabled={locked}
                  onChange={(event) =>
                    setChecked(event.target.checked ? shown.map((result) => result.employeeNo) : [])
                  }
                />
              </th>
              <th>이름</th>
              <th>부서</th>
              <th>비율 반영 점수</th>
              <th>보정 점수</th>
              <th>사유 (선택)</th>
              <th>최종 점수</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((result) => {
              const draft = drafts[result.employeeNo]
              const name = personByNo.get(result.employeeNo)?.name
              return (
                <tr
                  key={result.employeeNo}
                  className={result.adjustment !== null ? "scores-adjust-row-adjusted" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`${name} 체크`}
                      checked={checked.includes(result.employeeNo)}
                      disabled={locked}
                      onChange={() => toggleChecked(result.employeeNo)}
                    />
                  </td>
                  <td className="scores-adjust-name">{name}</td>
                  <td>{result.department}</td>
                  <td>{result.kpiApplied}</td>
                  <td>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      aria-label={`${name} 보정 점수`}
                      placeholder="보정 없음"
                      value={draft ? draft.score : result.adjustment === null ? "" : String(result.adjustment)}
                      disabled={locked}
                      onChange={(event) => setDraft(result.employeeNo, "score", event.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={`${name} 보정 사유`}
                      placeholder="사유"
                      value={draft?.reason ?? ""}
                      disabled={locked}
                      onChange={(event) => setDraft(result.employeeNo, "reason", event.target.value)}
                    />
                  </td>
                  <td className="scores-adjust-final">{result.final}</td>
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td className="scores-adjust-empty-row" colSpan={7}>
                  찾는 이름이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {message && (
        <p className={`scores-adjust-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      <button className="scores-adjust-save" type="button" disabled={locked} onClick={save}>
        저장
      </button>

      <section className="scores-adjust-card">
        <div className="scores-adjust-card-title">보정 기록 (지우거나 고칠 수 없음)</div>
        {log.length ? (
          <ul className="scores-adjust-log">
            {log.map((record, index) => (
              <li key={`${record.adjustedAt}-${record.employeeNo}-${index}`}>
                <span className="scores-adjust-log-when">{`${record.adjustedBy} · ${timeText(record.adjustedAt)}`}</span>
                <strong>{personByNo.get(record.employeeNo)?.name}</strong>
                <span>
                  {record.after === null
                    ? `${record.before}점 · 보정 취소`
                    : `${record.before}점 → ${record.after}점`}
                </span>
                {record.reason && <span className="scores-adjust-log-reason">{record.reason}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="scores-adjust-empty">아직 보정 기록이 없습니다.</p>
        )}
      </section>
    </div>
  )
}

export default ScoresAdjust
