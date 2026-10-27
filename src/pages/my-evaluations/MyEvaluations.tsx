import { useState } from "react"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  UsersRound,
} from "lucide-react"
import { participantProfiles, type ParticipantRole } from "@/data/participants"
import "./my-evaluations.css"

type EvaluationState = "진행 중" | "미완료" | "제출 완료"

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

type EvaluationTarget = {
  name: string
  department: string
  position: string
  state: EvaluationState
  progress: number
}

const positionOrder = ["팀장", "부장", "차장", "과장", "대리", "사원"]

const sortByPosition = (people: EvaluationTarget[]) =>
  [...people].sort(
    (a, b) =>
      positionOrder.indexOf(a.position) - positionOrder.indexOf(b.position),
  )

const teamMembers = sortByPosition([
  {
    name: "김민수",
    department: "생산팀",
    position: "사원",
    state: "제출 완료",
    progress: 100,
  },
  {
    name: "최유진",
    department: "생산팀",
    position: "대리",
    state: "진행 중",
    progress: 60,
  },
  {
    name: "정다은",
    department: "생산팀",
    position: "사원",
    state: "미완료",
    progress: 0,
  },
  {
    name: "오승현",
    department: "생산팀",
    position: "과장",
    state: "제출 완료",
    progress: 100,
  },
])

const executiveLeaders: EvaluationTarget[] = [
  {
    name: "박서준",
    department: "생산팀",
    position: "팀장",
    state: "제출 완료",
    progress: 100,
  },
  {
    name: "한지훈",
    department: "영업팀",
    position: "팀장",
    state: "진행 중",
    progress: 40,
  },
]

const executiveMembers = sortByPosition([
  {
    name: "윤태호",
    department: "생산팀",
    position: "과장",
    state: "미완료",
    progress: 0,
  },
  {
    name: "강수빈",
    department: "영업팀",
    position: "사원",
    state: "진행 중",
    progress: 30,
  },
  {
    name: "송지아",
    department: "연구개발팀",
    position: "대리",
    state: "제출 완료",
    progress: 100,
  },
  {
    name: "문현우",
    department: "경영지원팀",
    position: "차장",
    state: "미완료",
    progress: 0,
  },
])

function EvaluationTargetList({
  title,
  description,
  people,
  showSelfEvaluation,
}: {
  title: string
  description: string
  people: EvaluationTarget[]
  showSelfEvaluation: boolean
}) {
  return (
    <section className="member-list-card">
      <div className="member-list-header">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <div className="member-list">
        {people.map((member) => (
          <button type="button" key={member.name} className="member-row">
            <span className="member-avatar">{member.name.slice(0, 1)}</span>
            <span className="member-identity">
              <strong>{member.name}</strong>
              <small>
                {member.department} · {member.position}
              </small>
            </span>
            <span
              className={`member-submission ${member.state.replace(" ", "-")}`}
            >
              {showSelfEvaluation ? "자기평가 " : ""}
              {member.state}
            </span>
            <span className="member-progress">{member.progress}%</span>
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

  return (
    <div className="participant-page">
      <button type="button" className="back-button" onClick={onBack}>
        <ChevronRight size={20} />
        평가 목록으로
      </button>
      <div className="participant-heading">
        <div>
          <span>2025 상반기 정기 인사평가</span>
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
          <strong>2025. 04. 22</strong>
        </div>
      </div>

      <div className="member-status-summary">
        <div>
          <span>{isExecutive ? "전체 대상" : "전체 팀원"}</span>
          <strong>{isExecutive ? "6명" : "4명"}</strong>
        </div>
        <div>
          <span>{isExecutive ? "평가 완료" : "자기평가 완료"}</span>
          <strong>2명</strong>
        </div>
        <div>
          <span>{isExecutive ? "평가 필요" : "미완료"}</span>
          <strong>{isExecutive ? "4명" : "2명"}</strong>
        </div>
      </div>

      <div className="evaluation-target-groups">
        {isExecutive ? (
          <>
            <EvaluationTargetList
              title="팀장"
              description="부서별 팀장 평가 대상입니다."
              people={executiveLeaders}
              showSelfEvaluation={false}
            />
            <EvaluationTargetList
              title="팀원"
              description="직급이 높은 순서로 정렬되어 있습니다."
              people={executiveMembers}
              showSelfEvaluation={false}
            />
          </>
        ) : (
          <EvaluationTargetList
            title="생산팀 팀원"
            description="직급순으로 정렬되며 자기평가 제출 현황이 실시간으로 표시됩니다."
            people={teamMembers}
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
          <strong>2025. 04. 22</strong>
        </div>
      </div>

      {participantRole === "leader" && (
        <div className="leader-notice">
          <UsersRound size={24} />
          <div>
            <strong>팀원 2명이 아직 자기평가를 완료하지 않았어요.</strong>
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
              ? "내 평가 2개"
              : participantRole === "leader"
                ? "내 평가 2개"
                : "평가 대상 6명"}
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
              progress={60}
              state="진행 중"
              due="4월 22일 오후 6시까지"
            />
            <EvaluationCard
              eyebrow="상향 평가"
              title="팀장 평가"
              description="함께 일한 팀장의 리더십과 협업 역량을 평가합니다."
              progress={0}
              state="미완료"
              due="4월 22일 오후 6시까지"
            />
          </>
        )}
        {participantRole === "leader" && (
          <>
            <EvaluationCard
              eyebrow="나에 대한 평가"
              title="자기 평가"
              description="팀장으로서의 성과와 리더십을 돌아봅니다."
              progress={0}
              state="미완료"
              due="4월 22일 오후 6시까지"
              disabled
            />
            <EvaluationCard
              eyebrow="하향 평가"
              title="팀원 평가"
              description="팀원 4명의 성과를 확인하고 평가합니다."
              progress={50}
              state="진행 중"
              due="2 / 4명 평가 완료"
              onClick={() => setShowTeamMembers(true)}
            />
          </>
        )}
        {participantRole === "executive" && (
          <EvaluationCard
            eyebrow="임원 평가"
            title="평가 시작하기"
            description="팀장 2명과 팀원 4명의 성과와 조직 기여도를 평가합니다."
            progress={17}
            state="진행 중"
            due="1 / 6명 평가 완료"
            onClick={() => setShowTeamMembers(true)}
          />
        )}
      </div>
    </div>
  )
}

export default MyEvaluations
