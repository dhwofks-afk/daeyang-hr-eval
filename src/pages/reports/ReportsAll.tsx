import { useNavigate } from "react-router"
import { ArrowLeft, Download, FileBarChart } from "lucide-react"
import { downloadCsv, resultsCsv } from "./report-csv"
import { useReportSource } from "./report-source"
import "./reports.css"

// 리포트 > 전체 리포트: 전 직원 결과를 회사 전체 기준으로 정리한다 (요약 역할도 여기서 맡는다).
// 결과 확정과 개인 리포트는 리포트 > 개인 리포트(Reports.tsx)에 있다.
function ReportsAll() {
  const navigate = useNavigate()
  const report = useReportSource()
  const published = report.published

  // 확정 전: 지금 점수로 계산한 결과 / 확정 후: 확정 결과
  const source = published ? report.confirmed : report.liveResults

  // 파일 이름 예: 평가결과_1회차_확정_20261104.csv
  const download = () => {
    const now = new Date()
    const two = (value: number) => String(value).padStart(2, "0")
    const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`
    downloadCsv(
      `평가결과_${report.round}회차_${published ? "확정" : "확정전"}_${date}.csv`,
      resultsCsv(source, report.personByNo, report.opinions, report.suggestions),
    )
  }

  return (
    <div className="reports-page">
      <button type="button" className="reports-back" onClick={() => navigate("/admin/reports")}>
        <ArrowLeft size={19} />
        리포트로
      </button>

      <div className="detail-heading">
        <div className="detail-heading-icon">
          <FileBarChart size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            전체 리포트
          </div>
          <p>전 직원의 평가 결과를 회사 전체 기준으로 정리하고 엑셀로 내려받습니다.</p>
        </div>
      </div>

      <section className="reports-card">
        <div className="reports-card-title">전체 결과 내려받기</div>
        <p className="reports-card-help">
          {`점수, 평가 의견, 건의사항(익명)이 들어갑니다. (${
            published ? "확정 결과 기준" : "확정 전 현재 점수 기준"
          })`}
        </p>
        {report.status === "loading" && <p className="reports-card-help">불러오는 중입니다…</p>}
        {report.error && (
          <p className="reports-message error" role="status">
            {`불러오지 못했습니다. (${report.error})`}
          </p>
        )}
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
    </div>
  )
}

export default ReportsAll
