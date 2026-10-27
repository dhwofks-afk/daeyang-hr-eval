import { useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  UsersRound,
} from "lucide-react"
import { participantProfiles, type ParticipantRole } from "@/data/participants"
import { findPerson, positions, type Person } from "@/data/people"
import {
  currentEvaluation,
  executiveLeaderTargets,
  executiveMemberTargets,
  executiveTargetSummary,
  leaderTeamProgress,
  leaderTeamSummary,
  myEvaluationCards,
  type EvaluationProgress,
  type EvaluationState,
} from "@/data/evaluations"
import "./my-evaluations.css"

// 날짜가 정해지지 않았으면 "미정"으로 보여 준다.
const deadlineText = currentEvaluation.deadline ?? "미정"
const dueText = currentEvaluation.deadlineDetail
  ? `${currentEvaluation.deadlineDetail}까지`
  : "마감일 미정"

function EvaluationCard({
  eyebrow,
  title,
  description,
  progress,
  state,
  due,
  disabled = false,
  onClick,
}: {
  eyebrow: string
  title: string
  description: string
  progress: number
  state: EvaluationState
  due: string
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className={`evaluation-card ${disabled ? "muted" : ""}`}
      onClick={onClick}
    >
      <div className="evaluation-card-top">
        <span className="evaluation-kind">{eyebrow}</span>
        <span className={`evaluation-state ${state.replace(" ", "-")}`}>
          {state}
        </span>
      </div>
      <div className="evaluation-card-title">{title}</div>
      <p>{description}</p>
      <div className="evaluation-progress">
        <div>
          <span>진행률</span>
          <strong>{progress}%</strong>
        </div>
        <div className="evaluation-progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="evaluation-card-footer">
        <span>
          <Clock3 size={18} />
          {due}
        </span>
        <strong>
          {state === "제출 완료" ? "제출됨" : "평가 시작하기"}
          <ArrowRight size={19} />
        </strong>
      </div>
    </button>
  )
}

type EvaluationTarget = EvaluationProgress & { person: Person }

// 사원번호로 사람 정보를 붙인다.
const withPerson = (items: EvaluationProgress[]) =>
  items.flatMap((item) => {
    const person = findPerson(item.employeeNo)
    return person ? [{ ...item, person }] : []
  })

// 직급이 높은 순서로 정렬한다. 직급 순서는 people.ts의 positions를 따른다.
const sortByPosition = (targets: EvaluationTarget[]) =>
  [...targets].sort(
    (a, b) =>
      positions.indexOf(b.person.position) -
      positions.indexOf(a.person.position),
  )

// 팀장 미리보기 사람의 부서 (팀원 목록 제목에 쓴다)
const leaderDepartment =
  findPerson(participantProfiles.leader.employeeNo)?.department ?? ""
const teamMembers = sortByPosition(withPerson(leaderTeamProgress))
const executiveLeaders = withPerson(executiveLeaderTargets)
const executiveMembers = sortByPosition(withPerson(executiveMemberTargets))

function EvaluationTargetList({
  title,
  description,
  targets,
  showSelfEvaluation,
}: {
  title: string
  description: string
  targets: EvaluationTarget[]
  showSelfEvaluation: boolean
}) {
  return (
    <section className="member-list-card">
      <div className="member-list-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="member-list">
        {targets.map(({ person, state, progress }) => (
          <button type="button" key={person.employeeNo} className="member-row">
            <span className="member-avatar">{person.name.slice(0, 1)}</span>
            <span className="member-identity">
              <strong>{person.name}</strong>
              <small>
                {person.department} · {person.position}
              </small>
            </span>
            <span className={`member-submission ${state.replace(" ", "-")}`}>
              {showSelfEvaluation ? "자기평가 " : ""}
              {state}
            </span>
            <span className="member-progress">{progress}%</span>
            <span className="member-action">
              평가하기
              <ChevronRight size={19} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function TeamMemberEvaluationList({
  onBack,
  participantRole,
}: {
  onBack: () => void
  participantRole: "leader" | "executive"
}) {
  const isExecutive = participantRole === "executive"
  const summary = isExecutive ? executiveTargetSummary : leaderTeamSummary

  return (
    <div className="participant-page">
      <button type="button" className="back-button" onClick={onBack}>
        <ChevronRight size={20} />
        평가 목록으로
      </button>
      <div className="participant-heading">
        <div>
          <span>{currentEvaluation.name}</span>
          <div role="heading" aria-level={1}>
            {isExecutive ? "임원 평가 대상" : "팀원 평가"}
          </div>
          <p>
            {isExecutive
              ? "팀장과 팀원을 구분해 배정된 대상자의 평가를 진행하세요."
              : "팀원별 자기평가 제출 여부를 확인하고 평가를 진행하세요."}
          </p>
        </div>
        <div className="deadline-box">
          <CalendarDays size={22} />
          <span>평가 마감</span>
          <strong>{deadlineText}</strong>
        </div>
      </div>

      <div className="member-status-summary">
        <div>
          <span>{isExecutive ? "전체 대상" : "전체 팀원"}</span>
          <strong>{`${summary.total}명`}</strong>
        </div>
        <div>
          <span>{isExecutive ? "평가 완료" : "자기평가 완료"}</span>
          <strong>{`${summary.done}명`}</strong>
        </div>
        <div>
          <span>{isExecutive ? "평가 필요" : "미완료"}</span>
          <strong>{`${summary.remaining}명`}</strong>
        </div>
      </div>

      <div className="evaluation-target-groups">
        {isExecutive ? (
          <>
            <EvaluationTargetList
              title="팀장"
              description="부서별 팀장 평가 대상입니다."
              targets={executiveLeaders}
              showSelfEvaluation={false}
            />
            <EvaluationTargetList
              title="팀원"
              description="직급이 높은 순서로 정렬되어 있습니다."
              targets={executiveMembers}
              showSelfEvaluation={false}
            />
          </>
        ) : (
          <EvaluationTargetList
            title={`${leaderDepartment} 팀원`}
            description="직급순으로 정렬되며 자기평가 제출 현황이 실시간으로 표시됩니다."
            targets={teamMembers}
            showSelfEvaluation
          />
        )}
      </div>
    </div>
  )
}

function MyEvaluations({
  participantRole,
}: {
  participantRole: ParticipantRole
}) {
  const [showTeamMembers, setShowTeamMembers] = useState(false)
  const profile = participantProfiles[participantRole]
  const cards = myEvaluationCards

  if (showTeamMembers) {
    return (
      <TeamMemberEvaluationList
        participantRole={
          participantRole === "executive" ? "executive" : "leader"
        }
        onBack={() => setShowTeamMembers(false)}
      />
    )
  }

  return (
    <div className="participant-page">
      <div className="participant-heading">
        <div>
          <span>{profile.title} 평가</span>
          <div role="heading" aria-level={1}>
            {profile.name}님, 평가를 진행해 주세요.
          </div>
          <p>현재 진행 중인 평가만 모아 보여드려요.</p>
        </div>
        <div className="deadline-box">
          <CalendarDays size={22} />
          <span>평가 마감</span>
          <strong>{deadlineText}</strong>
        </div>
      </div>

      {participantRole === "leader" && (
        <div className="leader-notice">
          <UsersRound size={24} />
          <div>
            <strong>
              {`팀원 ${leaderTeamSummary.remaining}명이 아직 자기평가를 완료하지 않았어요.`}
            </strong>
            <span>팀원 평가에서 제출 현황을 확인할 수 있습니다.</span>
          </div>
          <button type="button" onClick={() => setShowTeamMembers(true)}>
            현황 확인
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      <div className="evaluation-section-heading">
        <div>
          <strong>평가 목록</strong>
          <span>
            {participantRole === "member"
              ? `내 평가 ${cards.member.count}개`
              : participantRole === "leader"
                ? `내 평가 ${cards.leader.count}개`
                : `평가 대상 ${cards.executive.targets.total}명`}
          </span>
        </div>
        <span className="evaluation-guide">
          제출 후에는 내용을 다시 열람할 수 없습니다.
        </span>
      </div>

      <div className="evaluation-card-grid">
        {participantRole === "member" && (
          <>
            <EvaluationCard
              eyebrow="나에 대한 평가"
              title="자기 평가"
              description="나의 성과와 역량을 돌아보고 직접 평가합니다."
              progress={cards.member.self.progress}
              state={cards.member.self.state}
              due={dueText}
            />
            <EvaluationCard
              eyebrow="상향 평가"
              title="팀장 평가"
              description="함께 일한 팀장의 리더십과 협업 역량을 평가합니다."
              progress={cards.member.leader.progress}
              state={cards.member.leader.state}
              due={dueText}
            />
          </>
        )}
        {participantRole === "leader" && (
          <>
            <EvaluationCard
              eyebrow="나에 대한 평가"
              title="자기 평가"
              description="팀장으로서의 성과와 리더십을 돌아봅니다."
              progress={cards.leader.self.progress}
              state={cards.leader.self.state}
              due={dueText}
              disabled
            />
            <EvaluationCard
              eyebrow="하향 평가"
              title="팀원 평가"
              description={`팀원 ${cards.leader.team.total}명의 성과를 확인하고 평가합니다.`}
              progress={cards.leader.team.progress}
              state={cards.leader.team.state}
              due={`${cards.leader.team.done} / ${cards.leader.team.total}명 평가 완료`}
              onClick={() => setShowTeamMembers(true)}
            />
          </>
        )}
        {participantRole === "executive" && (
          <EvaluationCard
            eyebrow="임원 평가"
            title="평가 시작하기"
            description={`팀장 ${cards.executive.targets.leaders}명과 팀원 ${cards.executive.targets.members}명의 성과와 조직 기여도를 평가합니다.`}
            progress={cards.executive.targets.progress}
            state={cards.executive.targets.state}
            due={`${cards.executive.targets.done} / ${cards.executive.targets.total}명 평가 완료`}
            onClick={() => setShowTeamMembers(true)}
          />
        )}
      </div>
    </div>
  )
}

export default MyEvaluations
