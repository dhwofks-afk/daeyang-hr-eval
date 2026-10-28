import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  FilePenLine,
  Gauge,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react"
import { useNavigate } from "react-router"
import { type IconType } from "@/layout/types"
import {
  deadlineCountdown,
  departmentScores,
  responseSummary,
  schedule,
} from "@/data/dashboard"
import "./admin-dashboard.css"

function CardHeader({
  icon: Icon,
  title,
  action,
  onAction,
}: {
  icon: IconType
  title: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div className="admin-dashboard-card-header">
      <div className="admin-dashboard-card-title">
        <Icon size={23} strokeWidth={2} />
        <span>{title}</span>
      </div>
      {action && (
        <button className="admin-dashboard-text-button" type="button" onClick={onAction}>
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
    <section className={`admin-dashboard-metric-card ${className}`}>
      <div className="admin-dashboard-metric-top">
        <span className="admin-dashboard-metric-icon">
          <Icon size={24} />
        </span>
        <span className="admin-dashboard-metric-label">{label}</span>
      </div>
      <div className="admin-dashboard-metric-value">
        {value}
        <span>{suffix}</span>
      </div>
      <div className="admin-dashboard-metric-helper">{helper}</div>
    </section>
  )
}

// 바로가기 버튼이 이동할 주소
// 평가 작성은 관리자용 주소가 없고, 관리자 페이지는 지금 있는 대시보드라 안내만 띄운다.
const quickActionPaths: Record<string, string | undefined> = {
  "응답 현황": "/admin/progress",
}

function AdminDashboard({
  onQuickAction,
}: {
  onQuickAction: (label: string) => void
}) {
  const navigate = useNavigate()

  const runQuickAction = (label: string) => {
    onQuickAction(label)
    const path = quickActionPaths[label]
    if (path) navigate(path)
  }

  return (
    <div className="admin-dashboard-grid">
      <section className="admin-dashboard-hero admin-dashboard-hero-wide">
        <div className="admin-dashboard-hero-copy">
          <div className="eyebrow">HR PERFORMANCE EVALUATION</div>
          <div className="admin-dashboard-hero-title" role="heading" aria-level={1}>
            함께 성장하는
            <br />
            <em>더 나은 내일을 만듭니다.</em>
          </div>
          <p className="admin-dashboard-hero-subtitle">
            공정한 평가와 명확한 기준으로 구성원의 지속적인 성장을
            지원합니다.
          </p>
          <button
            type="button"
            className="admin-dashboard-primary-button"
            onClick={() => navigate("/admin/progress")}
          >
            진행 현황 확인
            <ArrowRight size={21} />
          </button>
        </div>
        <div className="admin-dashboard-hero-art" aria-hidden="true">
          <div className="admin-dashboard-orbit admin-dashboard-orbit-one" />
          <div className="admin-dashboard-orbit admin-dashboard-orbit-two" />
          <div className="admin-dashboard-orbit admin-dashboard-orbit-three" />
          <div className="admin-dashboard-hero-lock">
            <LockKeyhole size={22} />
            <span>문항·사람 잠금</span>
          </div>
        </div>
      </section>

      <section className="admin-dashboard-content-card admin-dashboard-progress-card">
        <CardHeader
          icon={Gauge}
          title="평가 진행 현황"
          action="상세보기"
          onAction={() => navigate("/admin/progress")}
        />
        <div className="admin-dashboard-progress-layout">
          <div
            className="admin-dashboard-donut"
            aria-label={`전체 응답률 ${responseSummary.rate}%`}
          >
            <div>
              <strong>{`${responseSummary.rate}%`}</strong>
              <span>전체 응답률</span>
            </div>
          </div>
          <div className="admin-dashboard-response-summary">
            <div>
              <span className="admin-dashboard-status-dot admin-dashboard-muted" />
              <span>미응답</span>
              <strong>{`${responseSummary.pending}명`}</strong>
            </div>
            <div>
              <span className="admin-dashboard-status-dot admin-dashboard-teal" />
              <span>응답 완료</span>
              <strong>{`${responseSummary.completed}명`}</strong>
            </div>
            <div>
              <span className="admin-dashboard-status-dot admin-dashboard-blue" />
              <span>전체 인원</span>
              <strong>{`${responseSummary.total}명`}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-dashboard-content-card admin-dashboard-score-card">
        <CardHeader
          icon={BarChart3}
          title="부서별 평균 점수"
          action="상세보기"
          onAction={() => navigate("/admin/scores/results")}
        />
        <div className="admin-dashboard-score-list">
          {departmentScores.map((department) => (
            <div className="admin-dashboard-score-row" key={department.name}>
              <span>{department.name}</span>
              <strong>{department.score}</strong>
              <div className="admin-dashboard-score-track">
                <span style={{ width: `${department.score}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="admin-dashboard-score-caption">최종 보정 전 평균 점수 · 100점 만점</div>
      </section>

      <div className="admin-dashboard-main-column">
        <div className="admin-dashboard-metrics-grid">
          <MetricCard
            icon={UsersRound}
            label="전체 응답률"
            value={String(responseSummary.rate)}
            suffix="%"
            helper={`${responseSummary.completed} / ${responseSummary.total}명 응답`}
            className="admin-dashboard-cyan"
          />
          {/* 마감일이 정해지지 않았으면 "미정"으로 보여 준다. */}
          <MetricCard
            icon={Clock3}
            label="마감까지"
            value={
              deadlineCountdown.days === null
                ? "미정"
                : String(deadlineCountdown.days)
            }
            suffix={deadlineCountdown.days === null ? "" : "일"}
            helper={deadlineCountdown.detail ?? "마감일 미정"}
            className="admin-dashboard-blue"
          />
        </div>

        <section className="admin-dashboard-content-card admin-dashboard-shortcuts-card">
          <CardHeader icon={Sparkles} title="바로가기" action="바로가기 수정" />
          <div className="admin-dashboard-shortcut-list">
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

      <aside className="admin-dashboard-right-column">
        <section className="admin-dashboard-content-card admin-dashboard-schedule-card">
          <CardHeader icon={CalendarDays} title="다가오는 일정" action="전체보기" />
          <div className="admin-dashboard-schedule-list">
            {schedule.map((item) => (
              <div className="admin-dashboard-schedule-item" key={item.title}>
                <div className="admin-dashboard-schedule-date">
                  <strong>{item.date ?? "미정"}</strong>
                  {item.day && <span>({item.day})</span>}
                </div>
                <div className="admin-dashboard-schedule-detail">
                  <span className={`admin-dashboard-status-dot admin-dashboard-${item.tone}`} />
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-dashboard-insight-banner">
          <div>
            <Sparkles size={23} />
            <span>면담 지원 AX</span>
          </div>
          <strong>
            평가 결과를 바탕으로
            <br />
            면담 질문을 준비해보세요.
          </strong>
          <span className="admin-dashboard-pending-chip">관리자 전용</span>
        </section>
      </aside>
    </div>
  )
}

export default AdminDashboard
