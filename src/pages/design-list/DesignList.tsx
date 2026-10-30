import { useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  FilePenLine,
  Lock,
  Play,
  Settings,
  UsersRound,
} from "lucide-react"
import {
  questionSets,
  saveRoundSettings,
  startProblems,
  startRound,
  statusClass,
  targetSummary,
  useDesignState,
  type Round,
} from "@/data/design"
import { useScoreState } from "@/data/scores-store"
import "./design-list.css"

// 2026-11-03 → 2026. 11. 03 / 비었으면 "미정"
const dateText = (date: string | null) => (date ? date.split("-").join(". ") : "미정")

function DesignList() {
  const design = useDesignState()
  const targets = targetSummary()
  const [editingRound, setEditingRound] = useState<number | null>(null)
  const [startingRound, setStartingRound] = useState<number | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const editing = design.rounds.find((round) => round.round === editingRound)
  const starting = design.rounds.find((round) => round.round === startingRound)

  if (editing) {
    return (
      <DesignListSettings
        round={editing}
        onClose={(text) => {
          setEditingRound(null)
          setMessage(text ? { ok: true, text } : null)
        }}
      />
    )
  }

  const openSettings = (round: Round) => {
    setMessage(null)
    setEditingRound(round.round)
  }

  const begin = () => {
    if (!starting) return
    const started = startRound(starting.round)
    setStartingRound(null)
    setMessage(
      started
        ? { ok: true, text: "평가를 시작했습니다. 이제 문항을 수정할 수 없습니다." }
        : { ok: false, text: "평가를 시작할 수 없습니다. 카드의 안내를 확인해 주세요." },
    )
  }

  return (
    <div className="design-list-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <FilePenLine size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            평가 설계
          </div>
          <p>회차별 평가 기간과 대상을 확인하고, 준비가 끝나면 평가를 시작합니다.</p>
        </div>
      </div>

      {message && (
        <div className={`design-list-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </div>
      )}

      <div className="design-list-rounds">
        {design.rounds.map((round) => {
          const problems = round.status === "평가 전" ? startProblems(design, round) : []
          return (
            <article className="design-list-card" key={round.round}>
              <div className="design-list-card-top">
                <strong className="design-list-card-name">{round.name}</strong>
                <span className={`design-list-status ${statusClass[round.status]}`}>
                  {round.status}
                </span>
              </div>

              <dl className="design-list-facts">
                <div>
                  <dt>
                    <CalendarDays size={18} aria-hidden="true" />
                    평가 기간
                  </dt>
                  <dd>
                    {dateText(round.startDate)} — {dateText(round.deadline)}
                  </dd>
                </div>
                <div>
                  <dt>
                    <UsersRound size={18} aria-hidden="true" />
                    평가 대상
                  </dt>
                  <dd>{round.targetCount ?? targets.target}명</dd>
                </div>
              </dl>

              {round.status === "평가 전" && (
                <>
                  <div className="design-list-actions">
                    <button
                      type="button"
                      className="design-list-button"
                      onClick={() => openSettings(round)}
                    >
                      <Settings size={18} />
                      평가 기본 설정
                    </button>
                    <button
                      type="button"
                      className="design-list-button primary"
                      disabled={problems.length > 0}
                      onClick={() => {
                        setMessage(null)
                        setStartingRound(round.round)
                      }}
                    >
                      <Play size={18} />
                      평가 시작
                    </button>
                  </div>
                  {problems.length > 0 && (
                    <div className="design-list-problems">
                      <strong>평가를 시작하려면 아래를 먼저 해결해 주세요.</strong>
                      <ul>
                        {problems.map((problem) => (
                          <li key={problem}>{problem}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {round.status === "평가 중" && (
                <div className="design-list-actions">
                  <button
                    type="button"
                    className="design-list-button"
                    onClick={() => openSettings(round)}
                  >
                    <CalendarClock size={18} />
                    마감일 수정
                  </button>
                </div>
              )}

              {round.status === "평가 완료" && (
                <p className="design-list-readonly">
                  <Lock size={17} aria-hidden="true" />
                  끝난 평가입니다. 읽기만 할 수 있습니다.
                </p>
              )}
            </article>
          )
        })}
      </div>

      {starting && (
        <div className="design-list-backdrop" role="presentation">
          <div
            className="design-list-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="design-list-start-title"
            aria-describedby="design-list-start-description"
          >
            <span className="design-list-modal-icon">
              <AlertTriangle size={28} />
            </span>
            <div
              id="design-list-start-title"
              className="design-list-modal-title"
              role="heading"
              aria-level={2}
            >
              인사평가를 시작하시겠습니까?
            </div>
            <p id="design-list-start-description">
              평가를 시작하면 문항·대상자·평가자·평가 관계·조직도를 수정할 수 없습니다.
              마감일은 수정할 수 있습니다.
            </p>
            <div className="design-list-modal-name">
              {starting.name} · 평가표 {questionSets.length}종
            </div>
            <div className="design-list-actions">
              <button
                type="button"
                className="design-list-button"
                onClick={() => setStartingRound(null)}
              >
                취소
              </button>
              <button type="button" className="design-list-button primary" onClick={begin}>
                <Play size={18} />
                평가 시작
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 평가 기본 설정 (별도 주소 없이 평가 목록 안에서 연다)
function DesignListSettings({
  round,
  onClose,
}: {
  round: Round
  onClose: (savedText: string | null) => void
}) {
  const score = useScoreState()
  const targets = targetSummary()
  const [name, setName] = useState(round.name)
  const [startDate, setStartDate] = useState(round.startDate ?? "")
  const [deadline, setDeadline] = useState(round.deadline ?? "")
  const [problem, setProblem] = useState("")
  // 평가 중에는 마감일만 고칠 수 있다
  const onlyDeadline = round.status === "평가 중"
  const { member, leader } = score.weights

  const save = () => {
    if (!name.trim()) return setProblem("평가명을 입력해 주세요.")
    if (onlyDeadline && !deadline) return setProblem("평가 중에는 마감일을 비울 수 없습니다.")
    if (startDate && deadline && deadline < startDate)
      return setProblem("평가 마감일은 시작일보다 빠를 수 없습니다.")
    const saved = saveRoundSettings(round.round, {
      name: name.trim(),
      startDate: startDate || null,
      deadline: deadline || null,
    })
    if (!saved) return setProblem("끝난 평가는 수정할 수 없습니다.")
    onClose(onlyDeadline ? "마감일을 저장했습니다." : "평가 기본 설정을 저장했습니다.")
  }

  return (
    <div className="design-list-page">
      <button type="button" className="design-list-back" onClick={() => onClose(null)}>
        <ArrowLeft size={19} />
        평가 목록으로
      </button>

      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Settings size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">평가 설계</div>
          <div className="detail-title" role="heading" aria-level={1}>
            평가 기본 설정
          </div>
          <p>평가 이름과 기간을 정합니다. 날짜가 정해지지 않았으면 비워 두세요.</p>
        </div>
      </div>

      {onlyDeadline && (
        <div className="design-list-lock">
          <Lock size={20} />
          평가 중에는 마감일만 수정할 수 있습니다.
        </div>
      )}

      <section className="design-list-settings">
        <div className="design-list-settings-title">기본 정보</div>
        <div className="design-list-form">
          <label className="design-list-field full">
            <span>평가명</span>
            <input
              value={name}
              disabled={onlyDeadline}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <label className="design-list-field">
            <span>평가 시작일</span>
            <input
              type="date"
              value={startDate}
              disabled={onlyDeadline}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="design-list-field">
            <span>평가 마감일</span>
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </label>
          <div className="design-list-field full">
            <span>평가 대상</span>
            <div className="design-list-readout">
              대상 {targets.target}명 (전체 {targets.total}명 중 평가 제외 {targets.excluded}명)
            </div>
            <small>평가 제외는 사람·조직 화면에서 정합니다.</small>
          </div>
          <div className="design-list-field full">
            <span>가중치</span>
            <div className="design-list-readout">
              팀원용: 자기 {member.self} · 팀장 {member.leader} · 임원 {member.executive}
            </div>
            <div className="design-list-readout">
              팀장용: 자기 {leader.self} · 임원 {leader.executive} · 상향 반영 {leader.upward}
            </div>
            <small>가중치는 평가 결과 화면에서 정합니다.</small>
          </div>
        </div>

        {problem && (
          <div className="design-list-message error" role="alert">
            {problem}
          </div>
        )}

        <div className="design-list-actions end">
          <button type="button" className="design-list-button" onClick={() => onClose(null)}>
            취소
          </button>
          <button type="button" className="design-list-button primary" onClick={save}>
            설정 저장
          </button>
        </div>
      </section>
    </div>
  )
}

export default DesignList
