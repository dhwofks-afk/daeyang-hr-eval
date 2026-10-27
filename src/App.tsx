import { useState, type ComponentType } from "react"
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Database,
  Download,
  Eye,
  FileBarChart,
  FileSpreadsheet,
  FilePenLine,
  Gauge,
  Globe2,
  Languages,
  LayoutDashboard,
  Link2,
  LockKeyhole,
  LogOut,
  Menu,
  PanelLeftClose,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react"

type IconType = ComponentType<{ size?: number strokeWidth?: number }>

const participantMenu = [
  { label: "평가 목록", icon: ClipboardCheck },
  { label: "평가 결과 내보내기", icon: Download },
]

const adminMenu = [
  { label: "대시보드", icon: LayoutDashboard },
  { label: "사람·조직", icon: UsersRound },
  { label: "평가 설계", icon: FilePenLine },
  { label: "진행 관리", icon: Gauge },
  { label: "점수·보정", icon: BarChart3 },
  { label: "리포트", icon: FileBarChart },
  { label: "면담 지원 AX", icon: Sparkles },
  { label: "데이터 관리", icon: Database },
]

const departmentScores = [
  { name: "경영지원팀", score: 86.2 },
  { name: "생산팀", score: 82.7 },
  { name: "영업팀", score: 79.3 },
  { name: "연구개발팀", score: 76.8 },
]

const schedule = [
  {
    date: "04.15",
    day: "화",
    title: "상반기 인사평가 시작",
    detail: "팀원 평가 응답 기간",
    tone: "cyan",
  },
  {
    date: "04.18",
    day: "금",
    title: "팀장 평가 마감",
    detail: "오후 6시까지 제출",
    tone: "blue",
  },
  {
    date: "04.22",
    day: "화",
    title: "임원 평가 마감",
    detail: "오후 6시까지 제출",
    tone: "teal",
  },
]

type DetailSection = {
  label: string
  details: string[]
  status?: "보류" | "차후 연결" | "자료 대기"
}

type DetailPage = {
  area: "참여자 영역" | "관리자 영역"
  title: string
  description: string
  icon: IconType
  sections: DetailSection[]
}

type ParticipantRole = "member" | "leader" | "executive"
type UserRole = ParticipantRole | "admin"

const participantProfiles: Record<
  ParticipantRole,
  { name: string; title: string; department: string; avatar: string }
> = {
  member: {
    name: "김민수",
    title: "팀원",
    department: "생산팀 · 사원",
    avatar: "김",
  },
  leader: {
    name: "박서준",
    title: "팀장",
    department: "생산팀 · 팀장",
    avatar: "박",
  },
  executive: {
    name: "이정호",
    title: "임원",
    department: "경영본부 · 상무",
    avatar: "이",
  },
}

const detailPages: Record<string, DetailPage> = {
  "내 할 일": {
    area: "참여자 영역",
    title: "내 할 일",
    description: "해야 할 평가 목록과 상태, 진행률, 마감일을 확인합니다.",
    icon: ClipboardCheck,
    sections: [
      {
        label: "할 일 목록",
        details: ["상태: 미시작·진행 중·제출 완료", "진행률", "마감일"],
      },
    ],
  },
  "평가 작성": {
    area: "참여자 영역",
    title: "평가 작성",
    description: "평가 대상을 선택하고 평가를 작성해 제출합니다.",
    icon: FilePenLine,
    sections: [
      {
        label: "평가 대상 목록",
        details: [
          "팀장·임원 평가 대상 선택",
          "임원 평가 범위는 회사 확인 필요",
        ],
      },
      {
        label: "평가 입력·제출",
        details: [
          "객관식·서술형",
          "임시저장·진행률",
          "중복 응답 차단",
          "제출 후 잠금 및 재열람 불가",
        ],
      },
    ],
  },
  "내 설정": {
    area: "참여자 영역",
    title: "내 설정",
    description: "개인 계정과 화면 언어를 관리합니다.",
    icon: Settings,
    sections: [
      {
        label: "비밀번호 변경",
        details: ["첫 로그인 시 비밀번호 변경", "개인 비밀번호 변경"],
      },
      { label: "언어 선택", details: ["번역 언어 선택"] },
    ],
  },
  "내 결과": {
    area: "참여자 영역",
    title: "내 결과",
    description: "평가 결과를 필요한 파일 형식으로 내보냅니다.",
    icon: FileBarChart,
    sections: [
      {
        label: "PDF 내보내기",
        details: ["PDF 내보내기"],
      },
      {
        label: "Excel 내보내기",
        details: ["Excel 내보내기"],
      },
    ],
  },
  사람·조직: {
    area: "관리자 영역",
    title: "사람·조직",
    description: "직원, 조직, 계정과 평가 관계를 관리합니다.",
    icon: UsersRound,
    sections: [
      {
        label: "직원 목록",
        details: ["직원 추가·수정·삭제"],
      },
      { label: "조직도", details: ["부서 관리", "직급 관리"] },
      {
        label: "계정 관리",
        details: [
          "초기 비밀번호 발급·재발급",
          "사람당 개인 링크 1개 발급",
          "링크 만료 방식 미정",
        ],
      },
      {
        label: "평가 관계",
        details: [
          "누가 누구를 평가하는지",
          "부서 소속을 기반으로 자동 생성\u00A0\u00A0\u00A0",
          "관리자 수정 가능",
        ],
      },
    ],
  },
  "평가 설계": {
    area: "관리자 영역",
    title: "평가 설계",
    description: "평가 유형, 단계, 가중치, 마감일과 문항을 설정합니다.",
    icon: FilePenLine,
    sections: [
      {
        label: "평가 목록",
        details: ["설정 중·진행 중·종료 상태"],
      },
      {
        label: "평가 설계",
        details: [
          "가중치 설정",
          "평가 유형 설정",
          "마감일 선택",
        ],
      },
      {
        label: "문항 편집",
        details: [
          "평가별 웹에서 하나씩 편집",
          "엑셀 일괄 업로드",
          "문항 순서·구성 수정",
        ],
      },
      {
        label: "평가 시작",
        details: ["시작하면 문항·대상자·평가자·평가 관계 잠금"],
      },
    ],
  },
  "진행 관리": {
    area: "관리자 영역",
    title: "진행 관리",
    description: "사람별 응답 상태와 제출 이후의 운영 업무를 관리합니다.",
    icon: Gauge,
    sections: [
      {
        label: "응답 현황",
        details: ["사람별 상태", "진행률", "미완료자 현황"],
      },
      {
        label: "안내·독촉",
        details: ["시작 안내", "마감일 기준 알림", "미완료자 독촉"],
        status: "차후 연결",
      },
      {
        label: "제출 반려",
        details: ["제출 상태를 되돌려 다시 작성"],
      },
    ],
  },
  점수·보정: {
    area: "관리자 영역",
    title: "점수·보정",
    description: "단계별 점수와 최종 점수를 계산하고 보정합니다.",
    icon: BarChart3,
    sections: [
      {
        label: "평가 결과",
        details: ["단계별 점수", "가중 합산 최종 점수"],
      },
      {
        label: "최종 점수 보정",
        details: [
          "계산된 최종 점수에 가감",
          "보정 값만 기록",
          "가감 형태 미정",
        ],
      },
      {
        label: "부서 KPI 입력 반영",
        details: ["KPI 산식과 부서별 평가 항목 자료 필요"],
        status: "자료 대기",
      },
    ],
  },
  리포트: {
    area: "관리자 영역",
    title: "리포트",
    description: "평가 결과를 용도별 리포트로 정리합니다.",
    icon: FileBarChart,
    sections: [
      {
        label: "요약 리포트",
        details: ["요약 리포트에 들어갈 자료 체크리스트"],
      },
      {
        label: "개인 리포트",
        details: [
          "개인 리포트에 들어갈 자료 체크리스트",
          "직원 공개 여부·범위 미정",
        ],
        status: "보류",
      },
      {
        label: "면담 리포트",
        details: ["면담 리포트에 들어갈 자료 체크리스트"],
      },
    ],
  },
  "면담 지원 AX": {
    area: "관리자 영역",
    title: "면담 지원 AX",
    description: "평가 결과를 바탕으로 면담을 지원합니다.",
    icon: Sparkles,
    sections: [
      {
        label: "면담 지원",
        details: ["면담용 인사이트 정리", "면담 질문 추천", "인사팀장 열람"],
      },
    ],
  },
  "데이터 관리": {
    area: "관리자 영역",
    title: "데이터 관리",
    description: "평가 데이터를 내려받고 연초 시스템 데이터를 초기화합니다.",
    icon: Database,
    sections: [
      {
        label: "엑셀 내보내기",
        details: ["개인별 내보내기", "전체 내보내기"],
      },
      {
        label: "데이터 초기화",
        details: ["데이터 내려받기", "시스템 데이터 초기화"],
      },
    ],
  },
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </div>
  )
}

function NavItem({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  label: string
  icon: IconType
  active: boolean
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      type="button"
      onClick={onClick}
    >
      <Icon size={23} strokeWidth={1.8} />
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  )
}

function CardHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: IconType
  title: string
  action?: string
}) {
  return (
    <div className="card-header">
      <div className="card-title">
        <Icon size={23} strokeWidth={2} />
        <span>{title}</span>
      </div>
      {action && (
        <button className="text-button" type="button">
          {action}
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
  suffix,
  helper,
  className = "",
}: {
  icon: IconType
  label: string
  value: string
  suffix: string
  helper: string
  className?: string
}) {
  return (
    <section className={`metric-card ${className}`}>
      <div className="metric-top">
        <span className="metric-icon">
          <Icon size={24} />
        </span>
        <span className="metric-label">{label}</span>
      </div>
      <div className="metric-value">
        {value}
        <span>{suffix}</span>
      </div>
      <div className="metric-helper">{helper}</div>
    </section>
  )
}

function DetailModulePage({ page }: { page: DetailPage }) {
  const [activeSection, setActiveSection] = useState(page.sections[0].label)
  const section =
    page.sections.find((item) => item.label === activeSection) ??
    page.sections[0]
  const Icon = page.icon

  return (
    <div className="detail-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Icon size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">{page.area}</div>
          <div className="detail-title" role="heading" aria-level={1}>
            {page.title}
          </div>
          <p>{page.description}</p>
        </div>
      </div>

      <div className="detail-shell">
        <div
          className="section-tabs"
          role="tablist"
          aria-label={`${page.title} 하위 메뉴`}
        >
          {page.sections.map((item) => (
            <button
              type="button"
              role="tab"
              aria-selected={section.label === item.label}
              className={section.label === item.label ? "active" : ""}
              key={item.label}
              onClick={() => setActiveSection(item.label)}
            >
              <span>{item.label}</span>
              {item.status && <small>{item.status}</small>}
            </button>
          ))}
        </div>

        <section className="detail-content" role="tabpanel">
          <div className="detail-content-header">
            <div>
              <div
                className="detail-content-title"
                role="heading"
                aria-level={2}
              >
                {section.label}
              </div>
              {section.status && (
                <span
                  className={`detail-status ${
                    section.status === "보류" ? "pending" : ""
                  }`}
                >
                  {section.status}
                </span>
              )}
            </div>
            {page.title === "평가 설계" && section.label === "문항 편집" && (
              <button className="preview-button" type="button">
                <Eye size={20} />
                <span>미리보기</span>
              </button>
            )}
          </div>

          <div className="detail-layout">
            <div className="feature-summary">
              <div className="summary-label">화면 구성</div>
              <ul>
                {section.details.map((detail) => (
                  <li key={detail}>
                    <Check size={18} />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="empty-state">
              <div className="empty-icon">
                <ClipboardCheck size={34} strokeWidth={1.5} />
              </div>
              <strong>등록된 내용이 없습니다</strong>
              <p>실제 데이터가 등록되면 이 영역에 표시됩니다.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

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

function ParticipantEvaluationPage({
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

function ParticipantResultsPage() {
  return (
    <div className="participant-page results-page">
      <div className="participant-heading">
        <div>
          <span>평가 결과</span>
          <div role="heading" aria-level={1}>
            평가 결과 내보내기
          </div>
          <p>확정된 평가 결과를 원하는 파일 형식으로 내려받으세요.</p>
        </div>
      </div>
      <section className="result-summary-card">
        <div className="result-period">
          <span>최근 평가</span>
          <strong>2025 상반기 정기 인사평가</strong>
          <small>평가 종료 · 2025. 04. 30</small>
        </div>
        <div className="result-score">
          <span>최종 점수</span>
          <strong>84.6</strong>
          <small>100점 만점</small>
        </div>
      </section>
      <div className="export-grid">
        <button type="button" className="export-card">
          <span className="export-icon pdf">
            <FileBarChart size={30} />
          </span>
          <span>
            <strong>PDF 결과 리포트</strong>
            <small>평가 요약과 항목별 결과를 한눈에 확인합니다.</small>
          </span>
          <span className="download-action">
            <Download size={19} />
            PDF 다운로드
          </span>
        </button>
        <button type="button" className="export-card">
          <span className="export-icon excel">
            <FileSpreadsheet size={30} />
          </span>
          <span>
            <strong>Excel 상세 결과</strong>
            <small>평가 항목별 점수와 상세 데이터를 확인합니다.</small>
          </span>
          <span className="download-action">
            <Download size={19} />
            Excel 다운로드
          </span>
        </button>
      </div>
    </div>
  )
}

function LoginScreen({ onLogin }: { onLogin: (role: UserRole) => void }) {
  const [previewRole, setPreviewRole] = useState<UserRole>("member")

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <BrandMark />
          <div>
            <div className="brand-name">ROLLENT</div>
            <div className="brand-company">대양롤랜트㈜</div>
          </div>
        </div>
        <div className="login-message">
          <div className="eyebrow">HR PERFORMANCE EVALUATION</div>
          <div className="login-message-title" role="heading" aria-level={1}>
            공정한 평가로
            <br />
            함께 성장합니다.
          </div>
          <p>대양롤랜트㈜ 인사평가 시스템</p>
        </div>
        <div className="login-security">
          <ShieldCheck size={24} />
          <span>계정 권한에 따라 필요한 화면만 안전하게 제공됩니다.</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <div className="login-symbol">
              <LockKeyhole size={27} />
            </div>
            <div className="login-title" role="heading" aria-level={2}>
              로그인
            </div>
            <p>사원번호와 비밀번호를 입력해 주세요.</p>
          </div>

          <div className="role-preview">
            <div className="role-preview-label">
              <span>접속 화면 미리보기</span>
              <small>프로토타입 전용</small>
            </div>
            <div className="role-options">
              {(
                [
                  ["member", "팀원", "자기·팀장 평가", UserRound],
                  ["leader", "팀장", "자기·팀원 평가", UsersRound],
                  ["executive", "임원", "임원 평가", BarChart3],
                ] as const
              ).map(([value, label, description, Icon]) => (
                <button
                  type="button"
                  key={value}
                  className={previewRole === value ? "active" : ""}
                  onClick={() => setPreviewRole(value)}
                >
                  <Icon size={21} />
                  <span>
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </span>
                  {previewRole === value && <Check size={19} />}
                </button>
              ))}
              <button
                type="button"
                className={previewRole === "admin" ? "active" : ""}
                onClick={() => setPreviewRole("admin")}
              >
                <ShieldCheck size={21} />
                <span>
                  <strong>관리자</strong>
                  <small>관리자 권한자</small>
                </span>
                {previewRole === "admin" && <Check size={19} />}
              </button>
            </div>
            <p>실제 서비스에서는 로그인한 계정의 권한으로 자동 연결됩니다.</p>
          </div>

          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault()
              onLogin(previewRole)
            }}
          >
            <label>
              <span>사원번호</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="username"
                placeholder="사원번호 입력"
                required
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호 입력"
                required
              />
            </label>
            <button className="login-submit" type="submit">
              로그인
              <ArrowRight size={21} />
            </button>
          </form>

          <div className="login-help">
            <CircleHelp size={20} />
            <span>
              비밀번호를 잊은 경우 관리자에게 초기 비밀번호 재발급을 요청해
              주세요.
            </span>
          </div>

          <div className="personal-link-info">
            <Link2 size={21} />
            <div>
              <strong>개인 링크를 받으셨나요?</strong>
              <span>전달받은 링크를 열면 내 평가 목록으로 바로 연결됩니다.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [activeMenu, setActiveMenu] = useState("대시보드")
  const [languageOpen, setLanguageOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickMessage, setQuickMessage] = useState("")

  const selectMenu = (label: string) => {
    setActiveMenu(label)
    setMobileMenuOpen(false)
  }

  const runQuickAction = (label: string) => {
    setQuickMessage(`${label} 메뉴로 이동할 준비가 되었습니다.`)
    setActiveMenu(
      label === "평가 작성"
        ? "평가 작성"
        : label === "응답 현황"
          ? "진행 관리"
          : "대시보드",
    )
  }

  const login = (nextRole: UserRole) => {
    setRole(nextRole)
    setActiveMenu(nextRole === "admin" ? "대시보드" : "평가 목록")
  }

  const logout = () => {
    setRole(null)
    setActiveMenu("대시보드")
    setLanguageOpen(false)
    setMobileMenuOpen(false)
  }

  if (!role) {
    return <LoginScreen onLogin={login} />
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <BrandMark />
          <div>
            <div className="brand-name">ROLLENT</div>
            <div className="brand-company">대양롤랜트㈜</div>
          </div>
          <button
            className="sidebar-close"
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setMobileMenuOpen(false)}
          >
            <PanelLeftClose size={24} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="주 메뉴">
          {role !== "admin" ? (
            <>
              <div className="nav-section-label">참여자 영역</div>
              {participantMenu.map((item) => (
                <NavItem
                  key={item.label}
                  {...item}
                  active={activeMenu === item.label}
                  onClick={() => selectMenu(item.label)}
                />
              ))}
            </>
          ) : (
            <>
              <div className="nav-section-label">
                관리자 영역
                <span>관리자</span>
              </div>
              {adminMenu.map((item) => (
                <NavItem
                  key={item.label}
                  {...item}
                  active={activeMenu === item.label}
                  onClick={() => selectMenu(item.label)}
                />
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-language">
          <button
            type="button"
            onClick={() => setLanguageOpen((open) => !open)}
            aria-expanded={languageOpen}
          >
            <Globe2 size={22} />
            <span>한국어</span>
            <ChevronDown size={19} />
          </button>
          {languageOpen && (
            <div className="language-popover">
              <button type="button" onClick={() => setLanguageOpen(false)}>
                <Check size={17} /> 한국어
              </button>
              <button type="button" onClick={() => setLanguageOpen(false)}>
                Кыргызча
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-menu"
            type="button"
            aria-label="주 메뉴 열기"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu size={25} />
          </button>
          <div className="page-name">
            <span>{role === "admin" ? "관리자 영역" : "참여자 영역"}</span>
            <strong>{activeMenu}</strong>
          </div>
          <label className="search-box">
            <Search size={21} />
            <input
              type="search"
              placeholder="메뉴를 검색해보세요"
              aria-label="메뉴 검색"
            />
          </label>
          <div className="top-actions">
            <button type="button" className="header-action">
              <CircleHelp size={21} />
              <span>고객지원</span>
            </button>
            <button type="button" className="icon-button" aria-label="알림">
              <Bell size={22} />
              <span className="notification-dot" />
            </button>
            <button
              type="button"
              className="header-action logout-button"
              onClick={logout}
            >
              <LogOut size={21} />
              <span>로그아웃</span>
            </button>
            <button type="button" className="user-menu">
              <span className="avatar">
                {role === "admin" ? "관" : participantProfiles[role].avatar}
              </span>
              <span className="user-info">
                <strong>
                  {role === "admin" ? "관리자" : participantProfiles[role].name}
                </strong>
                <small>
                  {role === "admin"
                    ? "관리자"
                    : participantProfiles[role].department}
                </small>
              </span>
              <ChevronDown size={18} />
            </button>
          </div>
        </header>

        <main className="dashboard">
          {quickMessage && (
            <button
              className="toast"
              type="button"
              onClick={() => setQuickMessage("")}
            >
              <Check size={19} />
              {quickMessage}
              <span>닫기</span>
            </button>
          )}

          {role !== "admin" ? (
            activeMenu === "평가 목록" ? (
              <ParticipantEvaluationPage participantRole={role} />
            ) : (
              <ParticipantResultsPage />
            )
          ) : activeMenu === "대시보드" ? (
            <div className="dashboard-grid">
              <section className="hero dashboard-hero">
                <div className="hero-copy">
                  <div className="eyebrow">HR PERFORMANCE EVALUATION</div>
                  <div className="hero-title" role="heading" aria-level={1}>
                    함께 성장하는
                    <br />
                    <em>더 나은 내일을 만듭니다.</em>
                  </div>
                  <p className="hero-subtitle">
                    공정한 평가와 명확한 기준으로 구성원의 지속적인 성장을
                    지원합니다.
                  </p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => selectMenu("진행 관리")}
                  >
                    진행 현황 확인
                    <ArrowRight size={21} />
                  </button>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />
                  <div className="hero-lock">
                    <LockKeyhole size={22} />
                    <span>문항·사람 잠금</span>
                  </div>
                </div>
              </section>

              <section className="content-card progress-card">
                <CardHeader
                  icon={Gauge}
                  title="평가 진행 현황"
                  action="상세보기"
                />
                <div className="progress-layout">
                  <div className="donut" aria-label="전체 응답률 69%">
                    <div>
                      <strong>69%</strong>
                      <span>전체 응답률</span>
                    </div>
                  </div>
                  <div className="response-summary">
                    <div>
                      <span className="status-dot muted" />
                      <span>미응답</span>
                      <strong>11명</strong>
                    </div>
                    <div>
                      <span className="status-dot teal" />
                      <span>응답 완료</span>
                      <strong>24명</strong>
                    </div>
                    <div>
                      <span className="status-dot blue" />
                      <span>전체 인원</span>
                      <strong>35명</strong>
                    </div>
                  </div>
                </div>
              </section>

              <section className="content-card score-card">
                <CardHeader
                  icon={BarChart3}
                  title="부서별 평균 점수"
                  action="상세보기"
                />
                <div className="score-list">
                  {departmentScores.map((department) => (
                    <div className="score-row" key={department.name}>
                      <span>{department.name}</span>
                      <strong>{department.score}</strong>
                      <div className="score-track">
                        <span style={{ width: `${department.score}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="score-caption">
                  최종 보정 전 평균 점수 · 100점 만점
                </div>
              </section>

              <div className="main-column">
                <div className="metrics-grid">
                  <MetricCard
                    icon={UsersRound}
                    label="전체 응답률"
                    value="69"
                    suffix="%"
                    helper="24 / 35명 응답"
                    className="cyan"
                  />
                  <MetricCard
                    icon={Clock3}
                    label="마감까지"
                    value="7"
                    suffix="일"
                    helper="04월 22일 오후 6시"
                    className="blue"
                  />
                </div>

                <section className="content-card shortcuts-card">
                  <CardHeader
                    icon={Sparkles}
                    title="바로가기"
                    action="바로가기 수정"
                  />
                  <div className="shortcut-list">
                    {[
                      { label: "평가 작성", icon: FilePenLine },
                      { label: "응답 현황", icon: BarChart3 },
                      { label: "관리자 페이지", icon: ShieldCheck },
                    ].map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          type="button"
                          key={item.label}
                          onClick={() => runQuickAction(item.label)}
                        >
                          <Icon size={31} />
                          <span>{item.label}</span>
                          <ChevronRight size={19} />
                        </button>
                      )
                    })}
                  </div>
                </section>

              </div>

              <aside className="right-column">
                <section className="content-card schedule-card">
                  <CardHeader
                    icon={CalendarDays}
                    title="다가오는 일정"
                    action="전체보기"
                  />
                  <div className="schedule-list">
                    {schedule.map((item) => (
                      <div
                        className="schedule-item"
                        key={item.date + item.title}
                      >
                        <div className="schedule-date">
                          <strong>{item.date}</strong>
                          <span>({item.day})</span>
                        </div>
                        <div className="schedule-detail">
                          <span className={`status-dot ${item.tone}`} />
                          <div>
                            <strong>{item.title}</strong>
                            <span>{item.detail}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="insight-banner">
                  <div>
                    <Sparkles size={23} />
                    <span>면담 지원 AX</span>
                  </div>
                  <strong>
                    평가 결과를 바탕으로
                    <br />
                    면담 질문을 준비해보세요.
                  </strong>
                  <span className="pending-chip">관리자 전용</span>
                </section>
              </aside>
            </div>
          ) : (
            <DetailModulePage key={activeMenu} page={detailPages[activeMenu]} />
          )}
        </main>
      </div>
    </div>
  )
}

export default App
