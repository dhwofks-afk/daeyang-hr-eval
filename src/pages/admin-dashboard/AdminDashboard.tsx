import { useState, type CSSProperties } from "react"
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Gauge,
  UsersRound,
} from "lucide-react"
import { useNavigate } from "react-router"
import { type IconType } from "@/layout/types"
import { useProgressState } from "@/data/progress-store"
import { people } from "@/data/people"
import {
  adjustmentLog,
  departments,
  evaluationSetting,
  stageFieldScores,
} from "@/data/scores"
import { computeResults, type StageKey } from "@/lib/scoring"
import {
  deadlineLabel,
  departmentProgress,
  departmentScores,
  overallProgress,
  pendingEvaluators,
  stageProgress,
} from "./dashboard-summary"
import "./admin-dashboard.css"

const stageNames: Record<StageKey, string> = {
  self: "자기",
  leader: "팀장",
  executive: "임원",
  upward: "상향",
}

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

// onQuickAction은 routes.tsx가 넘겨 주지만 바로가기 카드를 빼서 지금은 쓰지 않는다.
// (routes.tsx는 공통 파일이라 그대로 두고 받는 자리만 남긴다)
function AdminDashboard(_props: { onQuickAction: (label: string) => void }) {
  const navigate = useNavigate()
  const [showPending, setShowPending] = useState(false)

  // 페이지를 열 때마다 평가 건 목록을 세서 숫자를 만든다.
  // 진행 관리와 같은 저장 자리를 읽어서, 거기서 반려하면 여기 숫자도 함께 바뀐다.
  const { cases: evaluationCases } = useProgressState()
  const departmentNames = departments.map((department) => department.name)
  const overall = overallProgress(evaluationCases)
  const stages = stageProgress(evaluationCases)
  const pending = pendingEvaluators(evaluationCases, people)
  const progressByDepartment = departmentProgress(
    evaluationCases,
    people,
    departmentNames,
  )
  // scoring.ts는 목록의 마지막 줄을 가장 최근 보정으로 본다.
  // 그래서 보정 시각(adjustedAt) 오름차순으로 정렬한 복사본을 넘긴다 (원본은 그대로).
  const sortedAdjustments = [...adjustmentLog].sort((a, b) =>
    a.adjustedAt.localeCompare(b.adjustedAt),
  )
  const results = computeResults({
    people,
    stageFieldScores,
    departments,
    weights: evaluationSetting.weights,
    kpi: evaluationSetting.kpi,
    gradeRatio: evaluationSetting.gradeRatio,
    adjustments: sortedAdjustments,
  })
  const scoresByDepartment = departmentScores(
    evaluationCases,
    results,
    departmentNames,
  )

  return (
    <div className="admin-dashboard-grid">
      <section className="admin-dashboard-band">
        <div className="admin-dashboard-band-title" role="heading" aria-level={1}>
          {evaluationSetting.name}
        </div>
        <span className="admin-dashboard-band-status">
          {evaluationSetting.status}
        </span>
        <span className="admin-dashboard-band-deadline">
          <CalendarDays size={20} />
          마감까지 {deadlineLabel(evaluationSetting.deadline)}
        </span>
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
            style={{ "--admin-dashboard-rate": overall.rate } as CSSProperties}
            aria-label={`전체 제출률 ${overall.rate}%`}
          >
            <div>
              <strong>{`${overall.rate}%`}</strong>
              <span>전체 제출률</span>
            </div>
          </div>
          <div className="admin-dashboard-stage-list">
            {stages.map((stage) => (
              <div className="admin-dashboard-stage-row" key={stage.stage}>
                <span>{stageNames[stage.stage]}</span>
                <strong>{`${stage.submitted} / ${stage.total}`}</strong>
              </div>
            ))}
            <div className="admin-dashboard-stage-row admin-dashboard-stage-total">
              <span>합계</span>
              <strong>{`${overall.submitted} / ${overall.total}건`}</strong>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="admin-dashboard-pending-button"
          aria-expanded={showPending}
          aria-controls="admin-dashboard-pending-list"
          onClick={() => setShowPending((open) => !open)}
        >
          <span>미제출 인원</span>
          <strong>{`${pending.length}명`}</strong>
          <ChevronDown size={20} />
        </button>
        {showPending && (
          <ul
            id="admin-dashboard-pending-list"
            className="admin-dashboard-pending-list"
          >
            {pending.map((person) => (
              <li key={person.employeeNo}>
                {`${person.name} (${person.department})`}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="admin-dashboard-side-column">
        <section className="admin-dashboard-content-card">
          <CardHeader
            icon={UsersRound}
            title="부서별 진행률"
            action="상세보기"
            onAction={() => navigate("/admin/progress")}
          />
          <div className="admin-dashboard-bar-list">
            {progressByDepartment.map((department) => (
              <div className="admin-dashboard-bar-row" key={department.name}>
                <span>{department.name}</span>
                <strong>{`${department.submitted}/${department.total}건 · ${department.rate}%`}</strong>
                <div className="admin-dashboard-track">
                  <span style={{ width: `${department.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-dashboard-content-card">
          <CardHeader
            icon={BarChart3}
            title="부서별 평균 점수"
            action="상세보기"
            onAction={() => navigate("/admin/scores/results")}
          />
          <div className="admin-dashboard-bar-list">
            {scoresByDepartment.map((department) => (
              <div className="admin-dashboard-bar-row" key={department.name}>
                <span>{department.name}</span>
                <span className="admin-dashboard-score-value">
                  {department.average === null ? (
                    <span className="admin-dashboard-in-progress">평가 진행 중</span>
                  ) : (
                    <strong>{`${department.average}점`}</strong>
                  )}
                  <span className="admin-dashboard-score-basis">
                    {`제출 완료 ${department.counted}/${department.total}명 기준`}
                  </span>
                </span>
                {department.average !== null && (
                  <div className="admin-dashboard-track">
                    <span style={{ width: `${department.average}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="admin-dashboard-caption">
            모든 평가를 제출받은 직원의 최종 점수 평균 · 100점 만점
          </div>
        </section>
      </div>
    </div>
  )
}

export default AdminDashboard
