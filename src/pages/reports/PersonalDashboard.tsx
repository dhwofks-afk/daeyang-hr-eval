import { type PersonRole } from "@/data/people"
import { type ConfirmedResult } from "@/data/reports"
import { round1, type MixRatio, type StageKey } from "@/lib/scoring"
import { type GivenUpward } from "./report-source"
import "./personal-dashboard.css"

// 개인 리포트 대시보드 (관리자 전용, docs/03-리포트.md 2번)
// 최종 점수 · 단계별 점수 · 부서 KPI · 본인이 한 상향 평가 · 종합 의견을 한 화면에 보여 준다. 등급은 쓰지 않는다.
// 점수는 받은 값을 보여 주기만 한다 (계산은 scoring.ts). 계산식 줄은 보여 주기용이다.

type Props = {
  result: Pick<ConfirmedResult, "stages" | "weighted" | "kpiApplied" | "final">
  role: PersonRole | undefined
  department: string
  kpi: number
  mix: MixRatio
  given: GivenUpward[] | null // null이면 자료 없음 (역할 미리보기)
  opinions: { stage: StageKey; opinion: string }[] | null
}

const stageLabels: Record<StageKey, string> = {
  self: "자기평가",
  leader: "팀장평가",
  executive: "임원평가",
  upward: "상향평가 (팀원 평균)",
  exec_upward: "임원상향평가",
}

// 역할마다 받는 단계: 팀원 3단계 / 팀장 2단계 + 상향 / 임원은 임원 상향만
const stagesOf = (role: PersonRole | undefined): StageKey[] =>
  role === "executive" ? ["exec_upward"] : role === "leader" ? ["self", "executive", "upward"] : ["self", "leader", "executive"]

// 종합 의견은 단계 이름으로만 보인다 (평가자 이름 없음). 자기평가에는 종합 의견이 없다 (평가 작성 화면 기준).
const opinionOrder: StageKey[] = ["leader", "executive", "upward", "exec_upward"]

const opinionLabels: Partial<Record<StageKey, string>> = {
  leader: "팀장",
  executive: "임원",
  upward: "상향 평가 (익명)",
  exec_upward: "임원 상향 평가 (익명)",
}

// 단계별로 묶는다. 여러 명이 쓴 의견(상향)은 쓴 순서로 평가자를 짐작할 수 없게 가나다순
function groupOpinions(opinions: { stage: StageKey; opinion: string }[]) {
  return opinionOrder
    .map((stage) => ({
      stage,
      texts: opinions
        .filter((item) => item.stage === stage)
        .map((item) => item.opinion.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ko")),
    }))
    .filter((group) => group.texts.length > 0)
}

const givenLabels: Partial<Record<StageKey, string>> = {
  upward: "상향평가 (팀장)",
  exec_upward: "임원상향평가",
}

const one = (value: number) => String(round1(value))

// 비율 반영 계산식 (예: 개인 80.4 × 80% + KPI 90 × 20% = 82.3)
function formula(props: Props) {
  const { result, role, kpi, mix } = props
  const upward = result.stages.upward ?? 0
  if (role === "executive") {
    return `임원상향평가 ${one(result.weighted)} × ${mix.executive.upward}% + KPI ${one(kpi)} × ${mix.executive.kpi}% = ${one(result.kpiApplied)}`
  }
  if (role === "leader") {
    return `개인 ${one(result.weighted)} × ${mix.leader.personal}% + KPI ${one(kpi)} × ${mix.leader.kpi}% + 상향 ${one(upward)} × ${mix.leader.upward}% = ${one(result.kpiApplied)}`
  }
  return `개인 ${one(result.weighted)} × ${mix.member.personal}% + KPI ${one(kpi)} × ${mix.member.kpi}% = ${one(result.kpiApplied)}`
}

const kpiRatioOf = (role: PersonRole | undefined, mix: MixRatio) =>
  role === "executive" ? mix.executive.kpi : role === "leader" ? mix.leader.kpi : mix.member.kpi

function PersonalDashboard(props: Props) {
  const { result, role, department, kpi, mix, given, opinions } = props
  const adjusted = round1(result.final) !== round1(result.kpiApplied)
  const opinionGroups = groupOpinions(opinions ?? [])

  return (
    <div className="reports-dash">
      <div className="reports-dash-tiles">
        <div className="reports-dash-final">
          <span>최종 점수</span>
          <strong>{one(result.final)}</strong>
          <small>{adjusted ? "보정됨 · 100점 만점" : "100점 만점"}</small>
        </div>
        <div className="reports-dash-tile">
          <span>{role === "executive" ? "임원상향평가" : "개인 평가"}</span>
          <strong>{one(result.weighted)}</strong>
        </div>
        <div className="reports-dash-tile">
          <span>비율 반영</span>
          <strong>{one(result.kpiApplied)}</strong>
        </div>
        <div className="reports-dash-tile">
          <span>보정</span>
          <strong>{adjusted ? one(result.final) : "없음"}</strong>
        </div>
      </div>

      <div className="reports-dash-grid">
        <section className="reports-dash-card">
          <div className="reports-dash-title">단계별 점수</div>
          <ul className="reports-dash-bars">
            {stagesOf(role).map((stage) => {
              const score = result.stages[stage]
              return (
                <li key={stage}>
                  <div className="reports-dash-bar-label">
                    <span>{stageLabels[stage]}</span>
                    {score === null ? (
                      <strong className="reports-dash-missing">미제출(0)</strong>
                    ) : (
                      <strong>{`${one(score)}점`}</strong>
                    )}
                  </div>
                  <div className="reports-dash-bar" aria-hidden="true">
                    <div style={{ width: `${Math.min(100, Math.max(0, score ?? 0))}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="reports-dash-card">
          <div className="reports-dash-title">부서 KPI</div>
          <dl className="reports-dash-facts">
            <div>
              <dt>부서</dt>
              <dd>{department}</dd>
            </div>
            <div>
              <dt>KPI 점수</dt>
              <dd>{`${one(kpi)}점`}</dd>
            </div>
            <div>
              <dt>최종 점수 반영 비율</dt>
              <dd>{`${kpiRatioOf(role, mix)}%`}</dd>
            </div>
          </dl>
          <p className="reports-dash-formula">{formula(props)}</p>
        </section>

        <section className="reports-dash-card">
          <div className="reports-dash-title">본인이 한 상향 평가</div>
          {given === null ? (
            <p className="reports-dash-empty">표시할 자료가 없습니다.</p>
          ) : given.length === 0 ? (
            <p className="reports-dash-empty">제출한 상향 평가가 없습니다.</p>
          ) : (
            <ul className="reports-dash-list">
              {given.map((item, index) => (
                <li key={`${index}-${item.targetName}`}>
                  <span>{`${item.targetName} · ${givenLabels[item.stage] ?? stageLabels[item.stage]}`}</span>
                  <strong>{item.score === null ? "—" : `${one(item.score)}점`}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="reports-dash-card reports-dash-card-wide">
          <div className="reports-dash-title">종합 의견</div>
          {opinions === null ? (
            <p className="reports-dash-empty">표시할 자료가 없습니다.</p>
          ) : opinionGroups.length === 0 ? (
            <p className="reports-dash-empty">제출된 종합 의견이 없습니다.</p>
          ) : (
            <ul className="reports-dash-opinions">
              {opinionGroups.map((group) => (
                <li key={group.stage}>
                  <span>{opinionLabels[group.stage] ?? stageLabels[group.stage]}</span>
                  {group.texts.map((text, index) => (
                    <p key={index}>{text}</p>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

export default PersonalDashboard
