import { useState } from "react"
import { Lock, Target } from "lucide-react"
import {
  saveKpi,
  scoreResults,
  useScoreConnection,
  useScoreState,
} from "@/data/scores-store"
import { round1 } from "@/lib/scoring"
import "./scores-kpi.css"

const average = (values: number[]) =>
  values.length
    ? round1(values.reduce((total, value) => total + value, 0) / values.length)
    : null

// 입력 칸 글자 → 숫자. 비었거나 숫자가 아니면 null
const toNumber = (text: string) => {
  const value = Number(text)
  return text.trim() !== "" && Number.isFinite(value) ? value : null
}

function ScoresKpiForm() {
  const store = useScoreState()
  const { departmentNames } = store
  const locked = store.resultPublished

  // 저장 전 입력값 (저장하면 저장 자리로 들어간다)
  const [kpiText, setKpiText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      departmentNames.map((name) => [name, String(store.departmentKpi[name])]),
    ),
  )
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const kpiValues = Object.fromEntries(
    departmentNames.map((name) => [name, toNumber(kpiText[name])]),
  )

  // 검사: KPI는 0~100
  const problems: string[] = []
  for (const name of departmentNames) {
    const value = kpiValues[name]
    if (value === null || value < 0 || value > 100) problems.push(`${name} KPI는 0~100 사이 숫자로 입력해 주세요.`)
  }
  const valid = problems.length === 0

  const draftDepartmentKpi = Object.fromEntries(
    departmentNames.map((name) => [name, kpiValues[name] ?? 0]),
  )

  // 반영 전 평균: 개인 평가 / 반영 후 평균: 지금 입력값으로 비율 섞은 점수
  const savedResults = scoreResults(store)
  const draftResults = scoreResults({ ...store, departmentKpi: draftDepartmentKpi })

  const save = async () => {
    if (!valid) {
      setMessage({ ok: false, text: problems[0] })
      return
    }
    setBusy(true)
    const failed = await saveKpi(draftDepartmentKpi)
    setBusy(false)
    setMessage(failed === null ? { ok: true, text: "저장했습니다. 평가 결과 표에 바로 반영됩니다." } : { ok: false, text: failed })
  }

  return (
    <div className="scores-kpi-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Target size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            KPI 반영
          </div>
          <p>부서별 KPI 점수(100점 기준)를 정합니다. 최종 점수에 섞는 비율은 평가 결과 화면에서 정합니다.</p>
        </div>
      </div>

      {locked && (
        <div className="scores-kpi-locked">
          <Lock size={20} />
          결과 확정됨 · 수정 불가
        </div>
      )}

      <section className="scores-kpi-card">
        <div className="scores-kpi-card-title">부서별 KPI 점수</div>
        <div className="scores-kpi-table-wrap">
          <table className="scores-kpi-table">
            <thead>
              <tr>
                <th>부서명</th>
                <th>인원</th>
                <th>KPI 점수</th>
                <th>개인 평가 평균</th>
                <th>KPI 반영 후 평균</th>
              </tr>
            </thead>
            <tbody>
              {departmentNames.map((name) => {
                const inDepartment = savedResults.filter((result) => result.department === name)
                const after = draftResults
                  .filter((result) => result.department === name)
                  .map((result) => result.kpiApplied)
                return (
                  <tr key={name}>
                    <td className="scores-kpi-name">{name}</td>
                    <td>{`${inDepartment.length}명`}</td>
                    <td>
                      <input
                        type="number"
                        inputMode="decimal"
                        aria-label={`${name} KPI 점수`}
                        value={kpiText[name]}
                        disabled={locked}
                        onChange={(event) =>
                          setKpiText({ ...kpiText, [name]: event.target.value })
                        }
                      />
                    </td>
                    <td>{average(inDepartment.map((result) => round1(result.weighted)))}</td>
                    <td className="scores-kpi-after">{valid ? average(after) : "—"}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {message && (
        <p className={`scores-kpi-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      <button className="scores-kpi-save" type="button" disabled={locked || busy} onClick={() => void save()}>
        {busy ? "저장 중" : "저장"}
      </button>
    </div>
  )
}

// 저장소 확인·읽는 동안에는 입력 칸을 그리지 않는다 (입력 칸의 처음 값이 저장소 값이 되도록)
function ScoresKpi() {
  const store = useScoreState()
  useScoreConnection()
  if (store.source === "checking" || store.source === "loading") {
    return <p className="scores-kpi-message">불러오는 중입니다…</p>
  }
  if (store.source === "error") {
    return (
      <p className="scores-kpi-message error" role="status">
        {`불러오지 못했습니다. (${store.error})`}
      </p>
    )
  }
  return <ScoresKpiForm key={store.source} />
}

export default ScoresKpi
