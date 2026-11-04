import { useNavigate } from "react-router"
import { ChevronRight, FileBarChart, UserRound, UsersRound } from "lucide-react"
import { useReportSource } from "./report-source"
import "./reports.css"

// 리포트 첫 화면: 개인 리포트 / 전체 리포트 카드 2개 (평가 설계 > 문항 편집 첫 화면과 같은 틀).
// 카드 전체가 버튼이라 어디를 눌러도 그 페이지로 들어간다.
function ReportsHome() {
  const navigate = useNavigate()
  const published = useReportSource().published

  return (
    <div className="reports-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <FileBarChart size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            리포트
          </div>
          <p>직원 한 명의 결과와 회사 전체 결과를 확인합니다.</p>
        </div>
      </div>

      <div className="reports-home-grid">
        <button
          type="button"
          className="reports-home-card"
          onClick={() => navigate("/admin/reports/personal")}
        >
          <span className="reports-home-card-top">
            <span className="reports-home-card-icon">
              <UserRound size={25} />
            </span>
            <span className={`reports-home-status ${published ? "published" : ""}`}>
              {published ? "확정됨" : "확정 전"}
            </span>
          </span>
          <span>
            <strong className="reports-home-card-title">개인 리포트</strong>
            <span className="reports-home-card-description">
              직원 한 명의 평가 결과를 보고 면담 자료로 씁니다. 여기서 결과를
              확정합니다.
            </span>
          </span>
          <span className="reports-home-card-go">
            들어가기
            <ChevronRight size={18} />
          </span>
        </button>

        <button
          type="button"
          className="reports-home-card"
          onClick={() => navigate("/admin/reports/all")}
        >
          <span className="reports-home-card-top">
            <span className="reports-home-card-icon">
              <UsersRound size={25} />
            </span>
          </span>
          <span>
            <strong className="reports-home-card-title">전체 리포트</strong>
            <span className="reports-home-card-description">
              전 직원의 평가 결과를 회사 전체 기준으로 정리합니다. 전체 결과를 엑셀로 내려받습니다.
            </span>
          </span>
          <span className="reports-home-card-go">
            들어가기
            <ChevronRight size={18} />
          </span>
        </button>
      </div>
    </div>
  )
}

export default ReportsHome
