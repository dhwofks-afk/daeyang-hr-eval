import { useState } from "react"
import { useNavigate } from "react-router"
import { ArrowLeft, FileBarChart, Lock } from "lucide-react"
import { publishedAtLabel } from "./report-store"
import { useReportSource } from "./report-source"
import PersonalDashboard from "./PersonalDashboard"
import "./reports.css"

// 결과 확정: 확정 결과를 저장하고 잠근다. 직원에게 공개하지 않는다 (개인 리포트·종합 의견은 관리자만).
type Confirm = "confirm" | "cancel"

// 리포트 > 개인 리포트 (관리자 전용): 결과를 확정하고, 직원 한 명의 결과를 본다. 면담 자료로도 쓴다.
// 전 직원 엑셀은 리포트 > 전체 리포트(ReportsAll.tsx)에 있다. 리포트 첫 화면은 ReportsHome.tsx.
function Reports() {
  const navigate = useNavigate()
  const report = useReportSource()
  const { published, liveResults, personByNo } = report // 결과 확정 여부

  // 확정 전: 지금 점수로 계산한 결과 / 확정 후: 확정 결과
  const previewSource = published ? report.confirmed : liveResults

  const [pickedNo, setPickedNo] = useState("")
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // 아직 고르지 않았으면 첫 직원 (저장소 자료는 화면을 연 뒤에 도착한다)
  const selectedNo = pickedNo || (liveResults[0]?.employeeNo ?? "")
  const selectedPerson = personByNo.get(selectedNo)
  const selectedResult = previewSource.find((result) => result.employeeNo === selectedNo)

  const apply = async (action: Confirm) => {
    setBusy(true)
    const failed = action === "confirm" ? await report.confirm() : await report.cancel()
    setBusy(false)
    setMessage(
      failed === null
        ? {
            ok: true,
            text:
              action === "confirm"
                ? "결과를 확정했습니다. 확정 결과가 저장되고 잠겼습니다."
                : "확정을 취소했습니다. 확정 결과는 남겨 두고 잠금만 풀었습니다.",
          }
        : { ok: false, text: `처리하지 못했습니다. 화면을 새로 보고 다시 시도해 주세요. (${failed})` },
    )
    setConfirm(null)
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
            개인 리포트
          </div>
          <p>결과를 확정하고 직원 한 명의 결과를 봅니다. 면담 자료로도 쓸 수 있습니다. 관리자만 볼 수 있습니다.</p>
        </div>
      </div>

      <section className="reports-card reports-status">
        <div>
          <span className="reports-status-label">결과 확정</span>
          <strong className={`reports-status-value ${published ? "published" : ""}`}>
            {published && report.publishedAt
              ? `확정됨 · ${publishedAtLabel(report.publishedAt)}`
              : "확정 전"}
          </strong>
        </div>
        {published ? (
          <button type="button" className="reports-danger" onClick={() => setConfirm("cancel")}>
            확정 취소
          </button>
        ) : (
          <button
            type="button"
            className="reports-primary"
            disabled={report.status !== "ready" || liveResults.length === 0}
            onClick={() => setConfirm("confirm")}
          >
            결과 확정
          </button>
        )}
      </section>

      {message && (
        <p className={`reports-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      {report.status === "loading" && <p className="reports-card-help">불러오는 중입니다…</p>}
      {report.error && (
        <p className="reports-message error" role="status">
          {`불러오지 못했습니다. (${report.error})`}
        </p>
      )}

      {published && (
        <div className="reports-locked">
          <Lock size={20} />
          결과가 확정되어 잠겼습니다. 바꾸려면 [확정 취소] 후 수정하세요.
        </div>
      )}

      <section className="reports-card">
        <div className="reports-card-title">개인 리포트 (관리자 전용)</div>
        <p className="reports-card-help">
          {published
            ? "확정 결과 기준입니다."
            : "확정 전이라 지금 점수로 계산한 결과입니다. 확정하는 순간의 점수가 저장됩니다."}
        </p>
        <label className="reports-select">
          <span>직원</span>
          <select value={selectedNo} onChange={(event) => setPickedNo(event.target.value)}>
            {liveResults.map((result) => {
              const person = personByNo.get(result.employeeNo)
              return (
                <option key={result.employeeNo} value={result.employeeNo}>
                  {`${result.department} · ${person?.name ?? result.employeeNo} ${person?.position ?? ""}`}
                </option>
              )
            })}
          </select>
        </label>

        <div className="reports-preview">
          <div className="reports-preview-caption">
            {`${selectedPerson?.name ?? "이 직원"}님 개인 리포트`}
          </div>
          {selectedResult ? (
            <PersonalDashboard
              result={selectedResult}
              role={selectedPerson?.role}
              department={selectedResult.department}
              kpi={report.departmentKpi[selectedResult.department] ?? 0}
              mix={report.mix}
              given={report.givenUpward(selectedNo)}
              opinions={report.opinions(selectedNo)}
            />
          ) : (
            <p className="reports-result-empty">이 직원은 확정 결과가 없습니다.</p>
          )}
        </div>
      </section>

      {confirm && (
        <div className="reports-overlay" role="dialog" aria-modal="true" aria-labelledby="reports-confirm-title">
          <div className="reports-confirm">
            <div id="reports-confirm-title" className="reports-confirm-title">
              {confirm === "confirm" ? "결과를 확정할까요?" : "확정을 취소할까요?"}
            </div>
            <p>
              {confirm === "confirm"
                ? "지금 점수로 확정 결과를 저장합니다. 확정하면 비율·KPI·보정을 바꿀 수 없습니다."
                : "잠금을 풉니다. 확정 결과는 지우지 않고 남겨 둡니다."}
            </p>
            <div className="reports-confirm-buttons">
              <button type="button" className="reports-secondary" onClick={() => setConfirm(null)}>
                닫기
              </button>
              <button
                type="button"
                className={confirm === "confirm" ? "reports-primary" : "reports-danger"}
                disabled={busy}
                onClick={() => void apply(confirm)}
              >
                {busy ? "처리 중" : confirm === "confirm" ? "결과 확정" : "확정 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
