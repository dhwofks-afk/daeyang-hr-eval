import { type VisibleResult } from "./report-store"

// 직원 한 명의 결과 화면. 공개 범위에 체크된 항목만 보여 준다.
// 리포트의 "개인 리포트 미리보기"에서 쓴다.
function PersonalResult({ result }: { result: VisibleResult }) {
  const scoreText = (score: number | null) => (score === null ? "미제출(0)" : `${score}점`)
  const empty =
    result.final === null &&
    result.grade === null &&
    result.stages === null &&
    result.upward === undefined

  if (empty) {
    return (
      <p className="reports-result-empty">
        공개 범위에 체크된 항목이 없어 직원 화면에 점수가 보이지 않습니다.
      </p>
    )
  }

  return (
    <div className="reports-result">
      {(result.final !== null || result.grade !== null) && (
        <div className="reports-result-main">
          {result.final !== null && (
            <div className="reports-result-big">
              <span>최종 점수</span>
              <strong>{result.final}</strong>
              <small>100점 만점</small>
            </div>
          )}
          {result.grade !== null && (
            <div className="reports-result-big">
              <span>등급</span>
              <strong>{result.grade}</strong>
              <small>A~D</small>
            </div>
          )}
        </div>
      )}

      {result.stages && (
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
      )}

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
