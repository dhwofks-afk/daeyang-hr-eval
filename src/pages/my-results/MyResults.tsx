import { Download, FileBarChart, FileSpreadsheet } from "lucide-react"
import "./my-results.css"

function MyResults() {
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

export default MyResults
