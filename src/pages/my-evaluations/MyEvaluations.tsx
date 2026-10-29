import { useState } from "react"
import { ArrowRight, CalendarDays, Check, Clock3, RotateCcw, Search } from "lucide-react"
import { useNavigate, useSearchParams } from "react-router"
import { participantProfiles, type ParticipantRole } from "@/data/participants"
import { findPerson, positions, type Person } from "@/data/people"
import {
  currentEvaluation,
  type CaseStatus,
  type EvaluationCase,
} from "@/data/evaluations"
import {
  casesOf,
  draftOf,
  previousStageOf,
  progressOf,
  useEvaluationStore,
  type EvaluationStore,
} from "./evaluation-store"
import { stageNames, statusNames } from "./evaluation-labels"
import EvaluationForm from "./EvaluationForm"
import "./my-evaluations.css"

// 마감일이 정해지지 않았으면 "미정"으로 보여 준다.
const deadlineText = currentEvaluation.deadline ?? "미정"

// 팀장·임원 목록의 상태 필터 (팀원은 카드가 2장이라 검색·필터를 보여 주지 않는다)
type StatusFilter = "all" | CaseStatus

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "not_started", label: statusNames.not_started },
  { key: "in_progress", label: statusNames.in_progress },
  { key: "submitted", label: statusNames.submitted },
  { key: "returned", label: statusNames.returned },
]

type CardItem = { item: EvaluationCase; target: Person }

// 반려된 건은 맨 위 묶음으로 따로 모으고, 나머지는 평가 대상에 따라 나눈다.
type SectionKey = "returned" | "self" | "leader" | "member"

const sectionOf = ({ item, target }: CardItem): SectionKey =>
  item.status === "returned"
    ? "returned"
    : item.stage === "self"
      ? "self"
      : target.role === "leader"
        ? "leader"
        : "member"

const sectionTitles: Record<SectionKey, string> = {
  returned: "반려된 평가",
  self: "나의 평가",
  leader: "팀장 평가",
  member: "팀원 평가",
}

function sectionDescription(key: SectionKey, cards: CardItem[]) {
  if (key === "returned") return "관리자가 반려한 평가입니다. 고쳐서 다시 제출해 주세요."
  if (key === "self") return "나의 성과와 역량을 돌아보고 직접 평가합니다."
  if (cards.some(({ item }) => item.stage === "upward"))
    return "함께 일한 팀장을 평가합니다. 작성자는 관리자만 볼 수 있습니다."
  if (cards.some(({ item }) => item.stage === "leader"))
    return "팀원의 자기평가를 확인하고 평가합니다. 직급이 높은 순서입니다."
  return "배정된 대상을 평가합니다. 직급이 높은 순서입니다."
}

// 직급이 높은 순서, 같으면 이름 순서. 직급 순서는 people.ts의 positions를 따른다.
const byPosition = (a: CardItem, b: CardItem) =>
  positions.indexOf(b.target.position) - positions.indexOf(a.target.position) ||
  a.target.name.localeCompare(b.target.name)

function EvaluationCard({
  store,
  card,
  onOpen,
}: {
  store: EvaluationStore
  card: CardItem
  onOpen: () => void
}) {
  const { item, target } = card
  const previous = previousStageOf(store, item)
  const progress = progressOf(item, draftOf(store, item.id))
  const returned = item.status === "returned"

  return (
    <button
      type="button"
      className={`my-evaluations-card ${returned ? "my-evaluations-card-returned" : ""}`}
      onClick={onOpen}
    >
      <div className="my-evaluations-card-top">
        <span className="my-evaluations-stage">{stageNames[item.stage]}</span>
        <span className={`my-evaluations-status my-evaluations-status-${item.status}`}>
          {statusNames[item.status]}
        </span>
      </div>
      {returned && (
        <div className="my-evaluations-returned-note">
          <RotateCcw size={18} />
          관리자가 반려했습니다
        </div>
      )}
      <div className="my-evaluations-target">
        <strong>{item.stage === "self" ? `${target.name} (본인)` : target.name}</strong>
        <span>{`${target.department} · ${target.position}`}</span>
      </div>
      {previous && (
        <div
          className={`my-evaluations-previous ${previous.done ? "my-evaluations-previous-done" : ""}`}
        >
          {previous.done ? <Check size={18} /> : <Clock3 size={18} />}
          {previous.done ? `${previous.label} 제출 완료` : `${previous.label} 제출 전`}
        </div>
      )}
      <div className="my-evaluations-card-footer">
        <span>{`답한 문항 ${progress.answered} / ${progress.total} · 마감 ${deadlineText}`}</span>
        <strong>
          {item.status === "submitted" ? "보기" : "평가하기"}
          <ArrowRight size={18} />
        </strong>
      </div>
    </button>
  )
}

function MyEvaluations({
  participantRole,
}: {
  participantRole: ParticipantRole
}) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const store = useEvaluationStore()
  const profile = participantProfiles[participantRole]
  // 작성 화면에 다녀와도 검색어·필터가 남도록 목록과 같은 자리에 둔다
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const showTools = participantRole !== "member"

  // 로그인한 사람이 평가자인 건만 보여 준다.
  const cards = casesOf(store, profile.employeeNo).flatMap((item) => {
    const target = findPerson(item.targetNo)
    return target ? [{ item, target }] : []
  })

  // ?case=번호 → 작성 화면. 내 건이 아니거나 없는 번호면 목록을 보여 준다.
  // (App.tsx가 주소를 정확히 같을 때만 찾아서 /my/evaluations/:번호 대신 이 방식을 쓴다)
  const opened = cards.find(({ item }) => String(item.id) === searchParams.get("case"))
  if (opened) {
    return (
      <EvaluationForm
        key={opened.item.id}
        item={opened.item}
        target={opened.target}
        myEmployeeNo={profile.employeeNo}
        onBack={() => navigate("/my/evaluations")}
      />
    )
  }

  const submittedCount = cards.filter(({ item }) => item.status === "submitted").length

  // 평가 대상 이름으로만 찾는다 (사번 검색 없음). 반려 묶음은 "전체"와 "반려"일 때 맨 위에 나온다.
  const keyword = query.trim()
  const filtering = showTools && (keyword !== "" || statusFilter !== "all")
  const shown = showTools
    ? cards.filter(
        ({ item, target }) =>
          target.name.includes(keyword) &&
          (statusFilter === "all" || item.status === statusFilter),
      )
    : cards
  const countOf = (key: StatusFilter) =>
    key === "all" ? cards.length : cards.filter(({ item }) => item.status === key).length
  const resetFilters = () => {
    setQuery("")
    setStatusFilter("all")
  }

  const sections = (["returned", "self", "leader", "member"] as SectionKey[])
    .map((key) => ({
      key,
      cards: shown.filter((card) => sectionOf(card) === key).sort(byPosition),
    }))
    .filter((section) => section.cards.length > 0)

  return (
    <div className="participant-page">
      <div className="participant-heading">
        <div>
          <span>{`${profile.title} 평가 · ${currentEvaluation.name}`}</span>
          <div role="heading" aria-level={1}>
            {profile.name}님, 평가를 진행해 주세요.
          </div>
          <p>{`해야 할 평가 ${cards.length}건 중 ${submittedCount}건을 제출했어요.`}</p>
        </div>
        <div className="my-evaluations-deadline-box">
          <CalendarDays size={22} />
          <span>평가 마감</span>
          <strong>{deadlineText}</strong>
        </div>
      </div>

      {showTools && (
        <div className="my-evaluations-tools">
          <label className="my-evaluations-search">
            <Search size={20} />
            <input
              type="search"
              value={query}
              placeholder="평가 대상 이름으로 찾기"
              aria-label="평가 대상 이름 검색"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="my-evaluations-filters" role="group" aria-label="상태 필터">
            {statusFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-pressed={statusFilter === filter.key}
                onClick={() => setStatusFilter(filter.key)}
              >
                {filter.label}
                <span>{countOf(filter.key)}</span>
              </button>
            ))}
          </div>
          {filtering && (
            <p className="my-evaluations-result-count" aria-live="polite">
              {`조건에 맞는 평가 ${shown.length}건`}
            </p>
          )}
        </div>
      )}

      {sections.length === 0 && (
        <div className="my-evaluations-empty">
          <p>조건에 맞는 평가가 없어요</p>
          <button type="button" onClick={resetFilters}>
            초기화
          </button>
        </div>
      )}

      {sections.map((section) => (
        <section
          key={section.key}
          className={`my-evaluations-section ${section.key === "returned" ? "my-evaluations-section-returned" : ""}`}
        >
          <div className="my-evaluations-section-heading">
            <div>
              <strong>{sectionTitles[section.key]}</strong>
              <span>{`${section.cards.length}건`}</span>
            </div>
            <p>{sectionDescription(section.key, section.cards)}</p>
          </div>
          <div className="my-evaluations-card-grid">
            {section.cards.map((card) => (
              <EvaluationCard
                key={card.item.id}
                store={store}
                card={card}
                onOpen={() => navigate(`/my/evaluations?case=${card.item.id}`)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

export default MyEvaluations
