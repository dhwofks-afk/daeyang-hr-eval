import { useState } from "react"
import { BarChart3, Lock } from "lucide-react"
import { evaluationSetting, stageFieldScores } from "@/data/scores"
import {
  departmentNames,
  personByNo,
  scoreResults,
  useScoreState,
} from "@/data/scores-store"
import { round1, type ScoreResult, type StageKey } from "@/lib/scoring"
import "./scores-results.css"

const roleNames = { member: "팀원", leader: "팀장" }

// 역할마다 받는 단계: 팀원 자기·팀장·임원 / 팀장 자기·임원·상향
const stagesOf = (role: ScoreResult["role"]): StageKey[] =>
  role === "member" ? ["self", "leader", "executive"] : ["self", "executive", "upward"]

const stageColumns: { key: StageKey; label: string }[] = [
  { key: "self", label: "자기" },
  { key: "leader", label: "팀장" },
  { key: "executive", label: "임원" },
  { key: "upward", label: "상향" },
]

// 받는 단계 중 제출된 단계 수 (상향은 한 명이라도 제출하면 제출로 센다)
function submittedCount(results: ScoreResult[]) {
  let submitted = 0
  let total = 0
  for (const result of results) {
    for (const stage of stagesOf(result.role)) {
      total++
      if (stageFieldScores[result.employeeNo]?.[stage]) submitted++
    }
  }
  return { submitted, total }
}

// 부서 → 최종 점수 높은 순
const byDepartmentThenFinal = (a: ScoreResult, b: ScoreResult) =>
  departmentNames.indexOf(a.department) - departmentNames.indexOf(b.department) ||
  b.final - a.final

function ScoresResults() {
  const store = useScoreState()
  const [department, setDepartment] = useState("전체")

  const results = scoreResults(store)
  const shown = results
    .filter((result) => department === "전체" || result.department === department)
    .sort(byDepartmentThenFinal)
  const count = submittedCount(results)
  const weights = evaluationSetting.weights

  return (
    <div className="scores-results-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <BarChart3 size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            평가 결과
          </div>
          <p>가중 합산 → KPI 반영 → 보정 → 등급 순서로 계산한 결과입니다.</p>
        </div>
      </div>

      {store.resultPublished && (
        <div className="scores-results-locked">
          <Lock size={20} />
          결과 공개됨 · 수정 불가
        </div>
      )}

      <section className="scores-results-summary">
        <div>
          <span>회차</span>
          <strong>{evaluationSetting.name}</strong>
        </div>
        <div>
          <span>상태</span>
          <strong>{evaluationSetting.status}</strong>
        </div>
        <div>
          <span>제출 현황 (단계)</span>
          <strong>{`제출 ${count.submitted} / 전체 ${count.total}`}</strong>
        </div>
        <div className="scores-results-weights">
          <span>현재 가중치 (수정은 평가 설계에서)</span>
          <strong>{`팀원 자기 ${weights.member.self} · 팀장 ${weights.member.leader} · 임원 ${weights.member.executive}`}</strong>
          <strong>{`팀장 자기 ${weights.leader.self} · 임원 ${weights.leader.executive} · 상향 반영 ${weights.leader.upward}%`}</strong>
        </div>
      </section>

      <div className="scores-results-filter" role="group" aria-label="부서 선택">
        {["전체", ...departmentNames].map((name) => (
          <button
            key={name}
            type="button"
            className={department === name ? "active" : ""}
            aria-pressed={department === name}
            onClick={() => setDepartment(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="scores-results-table-wrap">
        <table className="scores-results-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>부서</th>
              <th>직급</th>
              <th>역할</th>
              {stageColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>가중 합산</th>
              <th>KPI 반영</th>
              <th>최종</th>
              <th>등급</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((result) => {
              const person = personByNo.get(result.employeeNo)
              const weighted = round1(result.weighted)
              const change = round1(result.kpiApplied - weighted)
              return (
                <tr key={result.employeeNo}>
                  <td className="scores-results-name">{person?.name}</td>
                  <td>{result.department}</td>
                  <td>{person?.position}</td>
                  <td>{roleNames[result.role]}</td>
                  {stageColumns.map((column) => {
                    if (!stagesOf(result.role).includes(column.key)) {
                      return (
                        <td key={column.key} className="scores-results-none">
                          —
                        </td>
                      )
                    }
                    const score = result.stages[column.key]
                    return score === null ? (
                      <td key={column.key} className="scores-results-missing">
                        미제출(0)
                      </td>
                    ) : (
                      <td key={column.key}>{round1(score)}</td>
                    )
                  })}
                  <td>{weighted}</td>
                  <td>
                    {result.kpiApplied}
                    <span
                      className={`scores-results-change ${change > 0 ? "up" : change < 0 ? "down" : ""}`}
                    >
                      {change > 0 ? ` ▲${change}` : change < 0 ? ` ▼${-change}` : " –"}
                    </span>
                  </td>
                  <td className="scores-results-final">
                    {result.final}
                    {result.adjustment !== null && (
                      <span className="scores-results-adjusted">보정</span>
                    )}
                  </td>
                  <td className="scores-results-grade">{result.grade}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ScoresResults
