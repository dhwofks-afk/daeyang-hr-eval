import { useState } from "react"
import { Download, FileBarChart, Lock } from "lucide-react"
import { personByNo, scoreResults, useScoreState } from "@/data/scores-store"
import { publicScopeItems, reportSetting, type PublicScopeKey } from "@/data/reports"
import { downloadCsv, resultsCsv } from "./report-csv"
import {
  publishResults,
  publishedAtLabel,
  savePublicScope,
  unpublishResults,
  useReportState,
  visibleResult,
} from "./report-store"
import PersonalResult from "./PersonalResult"
import "./reports.css"

type Confirm = "publish" | "unpublish"

function Reports() {
  const report = useReportState()
  const scores = useScoreState()
  const published = report.resultPublished

  // 공개 전: 지금 점수로 계산한 결과 / 공개 후: 확정 결과
  const liveResults = scoreResults(scores)
  const previewSource = published ? report.confirmed : liveResults

  const [selectedNo, setSelectedNo] = useState(liveResults[0]?.employeeNo ?? "")
  const [confirm, setConfirm] = useState<Confirm | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const selectedPerson = personByNo.get(selectedNo)
  const selectedResult = previewSource.find((result) => result.employeeNo === selectedNo)

  const toggleScope = (key: PublicScopeKey) => {
    const next = report.publicScope.includes(key)
      ? report.publicScope.filter((item) => item !== key)
      : [...report.publicScope, key]
    savePublicScope(next)
  }

  const apply = (action: Confirm) => {
    const done = action === "publish" ? publishResults(liveResults) : unpublishResults()
    setMessage(
      done
        ? {
            ok: true,
            text:
              action === "publish"
                ? "결과를 공개했습니다. 직원이 내 평가 결과에서 볼 수 있습니다."
                : "공개를 취소했습니다. 직원 화면에는 다시 \"결과 준비 중\"이 보입니다.",
          }
        : { ok: false, text: "처리하지 못했습니다. 화면을 새로 보고 다시 시도해 주세요." },
    )
    setConfirm(null)
  }

  // 파일 이름 예: 평가결과_1회차_확정_20261104.csv
  const download = () => {
    const now = new Date()
    const two = (value: number) => String(value).padStart(2, "0")
    const date = `${now.getFullYear()}${two(now.getMonth() + 1)}${two(now.getDate())}`
    downloadCsv(
      `평가결과_${reportSetting.round}회차_${published ? "확정" : "공개전"}_${date}.csv`,
      resultsCsv(previewSource, personByNo),
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
            리포트
          </div>
          <p>직원에게 공개할 항목을 고르고 평가 결과를 공개합니다.</p>
        </div>
      </div>

      <section className="reports-card reports-status">
        <div>
          <span className="reports-status-label">공개 상태</span>
          <strong className={`reports-status-value ${published ? "published" : ""}`}>
            {published && report.publishedAt
              ? `공개됨 · ${publishedAtLabel(report.publishedAt)}`
              : "미공개"}
          </strong>
        </div>
        {published ? (
          <button type="button" className="reports-danger" onClick={() => setConfirm("unpublish")}>
            공개 취소
          </button>
        ) : (
          <button
            type="button"
            className="reports-primary"
            disabled={liveResults.length === 0}
            onClick={() => setConfirm("publish")}
          >
            결과 공개
          </button>
        )}
      </section>

      {message && (
        <p className={`reports-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      <section className="reports-card">
        <div className="reports-card-title">공개 범위</div>
        <p className="reports-card-help">
          체크한 항목만 전 직원의 내 평가 결과에 보입니다. 처음에는 모두 미공개입니다.
        </p>
        {published && (
          <div className="reports-locked">
            <Lock size={20} />
            공개 중에는 바꿀 수 없습니다. [공개 취소] 후 수정하세요.
          </div>
        )}
        <div className="reports-scope">
          {publicScopeItems.map((item) => (
            <label
              key={item.key}
              className={`reports-scope-item ${item.ready ? "" : "not-ready"}`}
            >
              <input
                type="checkbox"
                checked={report.publicScope.includes(item.key)}
                disabled={published || !item.ready}
                onChange={() => toggleScope(item.key)}
              />
              <span>{item.label}</span>
              {!item.ready && <small>준비 중</small>}
            </label>
          ))}
        </div>
      </section>

      <section className="reports-card">
        <div className="reports-card-title">개인 리포트 미리보기</div>
        <p className="reports-card-help">
          {published
            ? "공개된 확정 결과 기준입니다."
            : "공개 전이라 지금 점수로 계산한 결과입니다. 공개하는 순간의 점수가 확정됩니다."}
        </p>
        <label className="reports-select">
          <span>직원</span>
          <select value={selectedNo} onChange={(event) => setSelectedNo(event.target.value)}>
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
            {`${selectedPerson?.name ?? "이 직원"}님에게 이렇게 보입니다`}
          </div>
          {selectedResult ? (
            <PersonalResult
              result={visibleResult(
                selectedResult,
                selectedPerson?.role === "leader",
                report.publicScope,
              )}
            />
          ) : (
            <p className="reports-result-empty">이 직원은 확정 결과가 없습니다.</p>
          )}
        </div>
      </section>

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
          disabled={previewSource.length === 0}
          onClick={download}
        >
          <Download size={20} />
          전체 결과 엑셀로 내려받기
        </button>
      </section>

      <div className="reports-later">
        {[
          ["요약 리포트", "항목별·전체 선택 체크리스트, 회사 전체 대상"],
          ["면담 리포트", "직원별, 인사팀장만 열람"],
        ].map(([title, detail]) => (
          <section key={title} className="reports-card reports-later-card">
            <div className="reports-card-title">{title}</div>
            <p className="reports-card-help">{detail}</p>
            <span className="reports-badge">준비 중</span>
          </section>
        ))}
      </div>

      {confirm && (
        <div className="reports-overlay" role="dialog" aria-modal="true" aria-labelledby="reports-confirm-title">
          <div className="reports-confirm">
            <div id="reports-confirm-title" className="reports-confirm-title">
              {confirm === "publish" ? "결과를 공개할까요?" : "공개를 취소할까요?"}
            </div>
            <p>
              {confirm === "publish"
                ? "공개하면 점수·보정·KPI를 바꿀 수 없습니다."
                : "직원 화면에서 결과가 다시 숨겨집니다."}
            </p>
            {confirm === "publish" && report.publicScope.length === 0 && (
              <p className="reports-confirm-warning">
                공개 범위에 체크된 항목이 없어 직원 화면에 점수가 보이지 않습니다.
              </p>
            )}
            <div className="reports-confirm-buttons">
              <button type="button" className="reports-secondary" onClick={() => setConfirm(null)}>
                닫기
              </button>
              <button
                type="button"
                className={confirm === "publish" ? "reports-primary" : "reports-danger"}
                onClick={() => apply(confirm)}
              >
                {confirm === "publish" ? "결과 공개" : "공개 취소"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Reports
