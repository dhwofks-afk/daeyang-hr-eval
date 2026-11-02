import { Download, FileBarChart } from "lucide-react"
import { personByNo, scoreResults, useScoreState } from "@/data/scores-store"
import { reportSetting } from "@/data/reports"
import { downloadCsv, resultsCsv } from "./report-csv"
import { useReportState } from "./report-store"
import "./reports.css"

// 리포트 > 전체 리포트: 전 직원 결과를 관리자가 한꺼번에 본다.
// 결과 공개와 개인 리포트 미리보기는 리포트 > 개인 리포트(Reports.tsx)에 있다.
function ReportsAll() {
  const report = useReportState()
  const scores = useScoreState()
  const published = report.resultPublished

  // 공개 전: 지금 점수로 계산한 결과 / 공개 후: 확정 결과
  const source = published ? report.confirmed : scoreResults(scores)

  // 파일 이름 예: 평가결과_1회차_확정_20261104.csv
  const download = () => {
    const now = new Date()
    const two = (value: number) => String(value).padStart(2, "0")
    const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`
    downloadCsv(
      `평가결과_${reportSetting.round}회차_${published ? "확정" : "공개전"}_${date}.csv`,
      resultsCsv(source, personByNo),
    )
  }

  return (
    <div className="reports-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <FileBarChart size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            전체 리포트
          </div>
          <p>전 직원의 평가 결과를 내려받고 회사 전체 리포트를 봅니다.</p>
        </div>
      </div>

      <section className="reports-card">
        <div className="reports-card-title">전체 결과 내려받기</div>
        <p className="reports-card-help">
          {`관리자 전용입니다. 공개 범위와 상관없이 모든 항목이 들어갑니다. (${
            published ? "공개된 확정 결과 기준" : "공개 전이라 지금 점수로 계산한 결과 기준"
          })`}
        </p>
        <button
          type="button"
          className="reports-secondary reports-download"
          disabled={source.length === 0}
          onClick={download}
        >
          <Download size={20} />
          전체 결과 엑셀로 내려받기
        </button>
      </section>

      <div className="reports-later">
        <section className="reports-card reports-later-card">
          <div className="reports-card-title">요약 리포트</div>
          <p className="reports-card-help">항목별·전체 선택 체크리스트, 회사 전체 대상</p>
          <span className="reports-badge">준비 중</span>
        </section>
      </div>
    </div>
  )
}

export default ReportsAll
