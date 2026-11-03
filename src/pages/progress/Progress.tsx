// 진행 관리 > 응답 현황 (docs/08-진행관리.md 2번).
// 평가 건은 진행 관리 저장 자리(progress-store.ts)에서 읽는다.
// 실제 관리자 로그인이면 저장소, 역할 미리보기면 가짜 데이터 (가짜 데이터는 대시보드와 같은 목록이라 숫자가 같다)
import { useEffect, useRef, useState } from "react"
import { Check, Gauge, Lock, RotateCcw, Search, Undo2 } from "lucide-react"
import { type CaseStatus, type EvaluationCase } from "@/data/dashboard"
import { type Person } from "@/data/people"
import {
  progressView,
  returnBlockedReason,
  returnCase,
  useProgressConnection,
  useProgressState,
} from "@/data/progress-store"
import { useScoreState } from "@/data/scores-store"
import { type StageKey } from "@/lib/scoring"
// 요약 숫자는 대시보드와 같은 함수로 센다 (대시보드 파일은 읽기만 한다)
import { overallProgress, stageProgress } from "@/pages/admin-dashboard/dashboard-summary"
import "./progress.css"

const stageNames: Record<StageKey, string> = {
  self: "자기",
  leader: "팀장",
  executive: "임원",
  upward: "상향",
  exec_upward: "임원 상향",
}

const statusNames: Record<CaseStatus, string> = {
  not_started: "작성 전",
  in_progress: "작성 중",
  submitted: "제출",
  returned: "반려",
}

const stageKeys = Object.keys(stageNames) as StageKey[]
const statusKeys = Object.keys(statusNames) as CaseStatus[]

type View = "evaluator" | "target"

// 표 한 줄 = 평가 건. 사람 정보를 붙여 둔다.
type Row = { item: EvaluationCase; target: Person; evaluator: Person }

// 제출 시각 "2026-10-21T10:07" → "10/21 10:07"
const timeText = (value: string | null) =>
  value ? `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))} ${value.slice(11, 16)}` : "-"

const isDone = (item: EvaluationCase) => item.status === "submitted"

// [반려] → 사유 입력 창. 사유가 비어 있으면 [반려하기]를 누를 수 없다.
function ReturnDialog({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: Row
  busy: boolean // 저장소에 반려하는 중
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const reasonRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    reasonRef.current?.focus()
  }, [])

  return (
    <div className="progress-dialog-backdrop" onClick={onCancel}>
      <div
        className="progress-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="progress-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
      >
        <strong id="progress-dialog-title">평가를 반려할까요?</strong>
        <p>{`${row.target.name} · ${stageNames[row.item.stage]} 단계 · 평가자 ${row.evaluator.name}`}</p>
        <label>
          <span>반려 사유 (필수)</span>
          <textarea
            ref={reasonRef}
            rows={4}
            value={reason}
            placeholder="평가자가 보게 될 사유를 적어 주세요."
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <small>반려하면 평가자가 다시 고쳐서 제출해야 합니다. 반려 기록은 지우거나 고칠 수 없습니다.</small>
        <div>
          <button type="button" className="progress-dialog-cancel" onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className="progress-dialog-confirm"
            disabled={!reason.trim() || busy}
            onClick={() => onConfirm(reason)}
          >
            {busy ? "반려하는 중…" : "반려하기"}
          </button>
        </div>
      </div>
    </div>
  )
}

function Progress() {
  useProgressConnection()
  const progress = useProgressState()
  const { ready, cases, findPerson, departmentNames } = progressView(progress)
  const { resultPublished } = useScoreState()
  // 평가 중이 아니거나 결과가 공개되면 [반려]를 막고 이유를 보여 준다 (저장소면 그 회차 기준)
  const blocked = returnBlockedReason(resultPublished)
  const [returning, setReturning] = useState<Row | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [view, setView] = useState<View>("evaluator")
  const [department, setDepartment] = useState("전체")
  const [stage, setStage] = useState<"전체" | StageKey>("전체")
  const [status, setStatus] = useState<"전체" | CaseStatus>("전체")
  const [query, setQuery] = useState("")

  const overall = overallProgress(cases)
  const stages = stageProgress(cases)

  const rows: Row[] = cases.flatMap((item) => {
    const target = findPerson(item.targetNo)
    const evaluator = findPerson(item.evaluatorNo)
    return target && evaluator ? [{ item, target, evaluator }] : []
  })

  // 필터는 모두 함께 걸린다. 부서는 평가 대상의 부서(대시보드 부서별 진행률과 같은 기준),
  // 이름은 평가 대상 또는 평가자 이름에서 찾는다.
  const keyword = query.trim()
  const matches = ({ item, target, evaluator }: Row) =>
    (department === "전체" || target.department === department) &&
    (stage === "전체" || item.stage === stage) &&
    (status === "전체" || item.status === status) &&
    (keyword === "" || target.name.includes(keyword) || evaluator.name.includes(keyword))
  const filtering =
    department !== "전체" || stage !== "전체" || status !== "전체" || keyword !== ""
  const resetFilters = () => {
    setDepartment("전체")
    setStage("전체")
    setStatus("전체")
    setQuery("")
  }

  // 사람별 묶음: 평가자 기준은 "해야 할 평가", 평가 대상 기준은 "받을 평가".
  // 묶음 머리의 건수는 필터와 상관없이 그 사람의 전체 건으로 센다.
  const personOf = (row: Row) => (view === "evaluator" ? row.evaluator : row.target)
  const groups = [...new Set(rows.map((row) => personOf(row).employeeNo))]
    .map((employeeNo) => {
      const own = rows.filter((row) => personOf(row).employeeNo === employeeNo)
      return {
        person: personOf(own[0]),
        total: own.length,
        submitted: own.filter((row) => isDone(row.item)).length,
        rows: own.filter(matches),
      }
    })
    .filter((group) => group.rows.length > 0)
    // 미완료가 많은 사람이 위로, 같으면 부서 · 이름 순서
    .sort(
      (a, b) =>
        b.total - b.submitted - (a.total - a.submitted) ||
        departmentNames.indexOf(a.person.department) - departmentNames.indexOf(b.person.department) ||
        a.person.name.localeCompare(b.person.name),
    )
  const shownCases = groups.reduce((sum, group) => sum + group.rows.length, 0)

  const confirmReturn = async (reason: string) => {
    if (!returning || busy) return
    setBusy(true)
    const result = await returnCase(returning.item.id, reason, resultPublished)
    setBusy(false)
    setMessage(
      result.ok
        ? { ok: true, text: `${returning.target.name} · ${stageNames[returning.item.stage]} 단계 평가를 반려했습니다.` }
        : { ok: false, text: result.message },
    )
    setReturning(null)
  }

  return (
    <div className="progress-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Gauge size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            응답 현황
          </div>
          <p>누가 아직 평가를 하지 않았는지 사람별로 확인합니다.</p>
        </div>
      </div>

      {!ready && (
        <div className="progress-notice" role="status">
          {progress.source === "error" ? `불러오지 못했습니다. (${progress.error})` : "불러오는 중입니다…"}
        </div>
      )}
      {ready && blocked && (
        <div className="progress-notice progress-notice-locked">
          <Lock size={20} />
          {blocked}
        </div>
      )}
      {message && (
        <div
          className={`progress-notice ${message.ok ? "progress-notice-ok" : "progress-notice-locked"}`}
          role="status"
        >
          {message.ok ? <Check size={20} /> : <Lock size={20} />}
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)}>
            닫기
          </button>
        </div>
      )}

      <section className="progress-summary" aria-label="제출 요약">
        <div className="progress-summary-overall">
          <span>전체 제출률</span>
          <strong>{`${overall.rate}%`}</strong>
          <small>{`${overall.submitted} / ${overall.total}건`}</small>
        </div>
        {stages.map((item) => (
          <div key={item.stage} className="progress-summary-stage">
            <span>{stageNames[item.stage]}</span>
            <strong>{`${item.submitted} / ${item.total}`}</strong>
            <div className="progress-track">
              <span style={{ width: `${item.rate}%` }} />
            </div>
          </div>
        ))}
      </section>

      <section className="progress-tools">
        <div className="progress-view" role="group" aria-label="보기 전환">
          <button type="button" aria-pressed={view === "evaluator"} onClick={() => setView("evaluator")}>
            평가자 기준
          </button>
          <button type="button" aria-pressed={view === "target"} onClick={() => setView("target")}>
            평가 대상 기준
          </button>
        </div>
        <div className="progress-filters">
          <label>
            <span>부서</span>
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              <option value="전체">전체</option>
              {departmentNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>단계</span>
            <select value={stage} onChange={(event) => setStage(event.target.value as "전체" | StageKey)}>
              <option value="전체">전체</option>
              {stageKeys.map((key) => (
                <option key={key} value={key}>
                  {stageNames[key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>상태</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as "전체" | CaseStatus)}>
              <option value="전체">전체</option>
              {statusKeys.map((key) => (
                <option key={key} value={key}>
                  {statusNames[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="progress-search">
            <Search size={19} />
            <input
              type="search"
              value={query}
              placeholder="이름으로 찾기"
              aria-label="이름 검색 (평가 대상 또는 평가자)"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="progress-result">
          <span aria-live="polite">{`${groups.length}명 · 평가 건 ${shownCases}건`}</span>
          {filtering && (
            <button type="button" onClick={resetFilters}>
              <RotateCcw size={17} />
              초기화
            </button>
          )}
        </div>
      </section>

      {!ready ? null : groups.length === 0 ? (
        <div className="progress-empty">
          <p>조건에 맞는 평가 건이 없습니다</p>
          <button type="button" onClick={resetFilters}>
            초기화
          </button>
        </div>
      ) : (
        <table className="progress-table">
          <thead>
            <tr>
              <th scope="col">평가 대상</th>
              <th scope="col">부서</th>
              <th scope="col">단계</th>
              <th scope="col">평가자</th>
              <th scope="col">상태</th>
              <th scope="col">제출 시각</th>
              <th scope="col">
                <span className="progress-visually-hidden">반려</span>
              </th>
            </tr>
          </thead>
          {groups.map((group) => {
            const remaining = group.total - group.submitted
            return (
              <tbody key={group.person.employeeNo}>
                <tr className="progress-group-row">
                  <th scope="rowgroup" colSpan={7}>
                    <div className="progress-group">
                      <span className="progress-group-name">
                        <strong>{group.person.name}</strong>
                        <small>{`${group.person.department} · ${group.person.position}`}</small>
                      </span>
                      <span className="progress-group-count">
                        {`${view === "evaluator" ? "해야 할" : "받을"} 평가 ${group.total}건 중 ${group.submitted}건 제출`}
                      </span>
                      <span className={`progress-group-chip ${remaining ? "progress-group-chip-open" : ""}`}>
                        {remaining ? `미완료 ${remaining}건` : "완료"}
                      </span>
                    </div>
                  </th>
                </tr>
                {group.rows.map((row) => {
                  const { item, target, evaluator } = row
                  return (
                    <tr key={item.id} className="progress-case-row">
                      <td data-label="평가 대상">{target.name}</td>
                      <td data-label="부서">{target.department}</td>
                      <td data-label="단계">{stageNames[item.stage]}</td>
                      <td data-label="평가자">{evaluator.name}</td>
                      <td data-label="상태">
                        <span className={`progress-status progress-status-${item.status}`}>
                          {statusNames[item.status]}
                        </span>
                      </td>
                      <td data-label="제출 시각">{timeText(item.submittedAt)}</td>
                      <td className="progress-action-cell">
                        {/* [반려]는 "제출" 상태에만 보인다 */}
                        {item.status === "submitted" && (
                          <button
                            type="button"
                            className="progress-return-button"
                            disabled={blocked !== null}
                            title={blocked ?? undefined}
                            aria-label={`${target.name} ${stageNames[item.stage]} 단계 평가 반려`}
                            onClick={() => {
                              setMessage(null)
                              setReturning(row)
                            }}
                          >
                            <Undo2 size={17} />
                            반려
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            )
          })}
        </table>
      )}

      {returning && (
        <ReturnDialog
          row={returning}
          busy={busy}
          onCancel={() => setReturning(null)}
          onConfirm={(reason) => void confirmReturn(reason)}
        />
      )}
    </div>
  )
}

export default Progress
