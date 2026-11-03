import { type VisibleResult } from "./report-store"
import "./personal-result.css"

// 직원 한 명의 결과 (관리자 전용 개인 리포트). 등급은 쓰지 않는다.
function PersonalResult({ result }: { result: VisibleResult }) {
  const scoreText = (score: number | null) => (score === null ? "미제출(0)" : `${score}점`)
  return (
    <div className="reports-result">
      <div className="reports-result-main">
        <div className="reports-result-big">
          <span>최종 점수</span>
          <strong>{result.final}</strong>
          <small>100점 만점</small>
        </div>
      </div>

      <div className="reports-result-section">
          <div className="reports-result-section-title">단계별 점수</div>
          <ul className="reports-result-list">
            {result.stages.map((stage) => (
              <li key={stage.label}>
                <span>{stage.label}</span>
                <strong>{scoreText(stage.score)}</strong>
              </li>
            ))}
          </ul>
      </div>

      {result.upward !== undefined && (
        <div className="reports-result-section">
          <div className="reports-result-section-title">상향 평가 점수</div>
          <ul className="reports-result-list">
            <li>
              <span>팀원 평가 평균</span>
              <strong>{scoreText(result.upward)}</strong>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default PersonalResult
