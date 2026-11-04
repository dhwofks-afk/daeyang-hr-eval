import { useEffect, useState, type CSSProperties } from "react"
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
import { progressView, useProgressConnection, useProgressState } from "@/data/progress-store"
import { people } from "@/data/people"
import {
  adjustmentLog,
  departments,
  evaluationSetting,
  stageFieldScores,
} from "@/data/scores"
import { cycleStatusNames, loadCurrentCycle, loadScoreData, scoreResultsOf } from "@/lib/admin-data"
import { computeResults, type ScoreResult, type StageKey } from "@/lib/scoring"
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
  self: "자기평가",
  leader: "팀장평가",
  executive: "임원평가",
  upward: "상향평가",
  exec_upward: "임원상향평가",
}


// 역할 미리보기(가짜 데이터)의 점수: scores.ts 값으로 scoring.ts가 계산한다.
// scoring.ts는 목록의 마지막 줄을 가장 최근 보정으로 본다.
// 그래서 보정 시각(adjustedAt) 오름차순으로 정렬한 복사본을 넘긴다 (원본은 그대로).
function fakeResults() {
  const sortedAdjustments = [...adjustmentLog].sort((a, b) =>
    a.adjustedAt.localeCompare(b.adjustedAt),
  )
  return computeResults({
    people,
    stageFieldScores,
    departments,
    weights: evaluationSetting.weights,
    mix: evaluationSetting.mix,
    adjustments: sortedAdjustments,
  })
}

type ServerScores = { results: ScoreResult[] } | { error: string } | null

// 저장소 점수: 읽는 데 오래 걸려서(7~8초) 제출 현황을 먼저 보여 주고 나중에 채운다.
// 계산은 admin-data의 scoreResultsOf (scoring.ts). 저장소가 아니면 읽지 않는다
function useServerScores(isServer: boolean) {
  const [scores, setScores] = useState<ServerScores>(null)
  useEffect(() => {
    if (!isServer) return
    let alive = true
    const load = async () => {
      const cycle = await loadCurrentCycle()
      if (!cycle) throw new Error("회차가 없습니다.")
      return scoreResultsOf(await loadScoreData(cycle))
    }
    load()
      .then((results) => alive && setScores({ results }))
      .catch((caught) => alive && setScores({ error: caught instanceof Error ? caught.message : String(caught) }))
    return () => {
      alive = false
    }
  }, [isServer])
  return isServer ? scores : null
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

function AdminDashboard() {
  const navigate = useNavigate()
  const [showPending, setShowPending] = useState(false)

  // 페이지를 열 때마다 평가 건 목록을 세서 숫자를 만든다.
  // 진행 관리와 같은 저장 자리를 읽어서, 거기서 반려하면 여기 숫자도 함께 바뀐다.
  // 실제 관리자 로그인이면 저장소 칸, 역할 미리보기면 가짜 칸 (progressView)
  useProgressConnection()
  const progress = useProgressState()
  const view = progressView(progress)
  const server = progress.source === "server" ? progress.server : null
  const serverScores = useServerScores(server !== null)
  const { cases: evaluationCases, people, departmentNames } = view
  const band = server
    ? { name: server.cycleName, status: cycleStatusNames[server.cycleStatus], deadline: server.deadline }
    : evaluationSetting
  const overall = overallProgress(evaluationCases)
  const stages = stageProgress(evaluationCases)
  const pending = pendingEvaluators(evaluationCases, people)
  const progressByDepartment = departmentProgress(
    evaluationCases,
    people,
    departmentNames,
  )
  // 저장소 점수가 아직 없으면(읽는 중·오류) null → 부서별 평균 카드에 안내만 보인다
  const results = server
    ? serverScores && "results" in serverScores
      ? serverScores.results
      : null
    : fakeResults()
  const scoresByDepartment = results
    ? departmentScores(evaluationCases, results, departmentNames)
    : null
  const scoreNotice =
    serverScores && "error" in serverScores
      ? `점수를 불러오지 못했습니다. (${serverScores.error})`
      : "점수를 불러오는 중입니다…"

  if (!view.ready) {
    return (
      <div className="admin-dashboard-grid">
        <section className="admin-dashboard-content-card" role="status">
          {progress.source === "error"
            ? `불러오지 못했습니다. (${progress.error})`
            : "불러오는 중입니다…"}
        </section>
      </div>
    )
  }

  return (
    <div className="admin-dashboard-grid">
      <section className="admin-dashboard-band">
        <div className="admin-dashboard-band-title" role="heading" aria-level={1}>
          {band.name}
        </div>
        <span className="admin-dashboard-band-status">
          {band.status}
        </span>
        <span className="admin-dashboard-band-deadline">
          <CalendarDays size={20} />
          마감까지 {deadlineLabel(band.deadline)}
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
          {!scoresByDepartment && (
            <div className="admin-dashboard-caption" role="status">
              {scoreNotice}
            </div>
          )}
          <div className="admin-dashboard-bar-list">
            {(scoresByDepartment ?? []).map((department) => (
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
