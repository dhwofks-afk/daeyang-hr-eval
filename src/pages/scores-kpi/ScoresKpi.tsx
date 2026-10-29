import { useState } from "react"
import { Lock, Target } from "lucide-react"
import {
  departmentNames,
  saveKpi,
  scoreResults,
  useScoreState,
} from "@/data/scores-store"
import { applyKpi, round1, type KpiSetting } from "@/lib/scoring"
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

function ScoresKpi() {
  const store = useScoreState()
  const locked = store.resultPublished

  // 저장 전 입력값 (저장하면 저장 자리로 들어간다)
  const [method, setMethod] = useState<KpiSetting["method"]>(store.kpi.method)
  const [base, setBase] = useState(String(store.kpi.base))
  const [factor, setFactor] = useState(String(store.kpi.factor))
  const [kpiText, setKpiText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      departmentNames.map((name) => [name, String(store.departmentKpi[name])]),
    ),
  )
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const baseValue = toNumber(base)
  const factorValue = toNumber(factor)
  const kpiValues = Object.fromEntries(
    departmentNames.map((name) => [name, toNumber(kpiText[name])]),
  )

  // 검사: 기준값·KPI는 0~100, 계수는 0 이상
  const problems: string[] = []
  if (baseValue === null || baseValue < 0 || baseValue > 100) problems.push("기준값은 0~100 사이 숫자로 입력해 주세요.")
  if (factorValue === null || factorValue < 0) problems.push("계수는 0 이상 숫자로 입력해 주세요.")
  for (const name of departmentNames) {
    const value = kpiValues[name]
    if (value === null || value < 0 || value > 100) problems.push(`${name} KPI는 0~100 사이 숫자로 입력해 주세요.`)
  }
  const valid = problems.length === 0

  const draftKpi: KpiSetting = { method, base: baseValue ?? 0, factor: factorValue ?? 0 }
  const draftDepartmentKpi = Object.fromEntries(
    departmentNames.map((name) => [name, kpiValues[name] ?? 0]),
  )

  // 반영 전 평균: 가중 합산 / 반영 후 평균: 지금 입력값으로 KPI 반영한 점수
  const savedResults = scoreResults(store)
  const draftResults = scoreResults({
    ...store,
    kpi: draftKpi,
    departmentKpi: draftDepartmentKpi,
  })

  const save = () => {
    if (!valid) {
      setMessage({ ok: false, text: problems[0] })
      return
    }
    const saved = saveKpi(draftKpi, draftDepartmentKpi)
    setMessage(
      saved
        ? { ok: true, text: "저장했습니다. 평가 결과 표에 바로 반영됩니다." }
        : { ok: false, text: "결과가 공개되어 수정할 수 없습니다." },
    )
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
          <p>부서 성과(KPI)를 개인 점수에 반영하는 방식과 부서별 KPI 점수를 정합니다.</p>
        </div>
      </div>

      {locked && (
        <div className="scores-kpi-locked">
          <Lock size={20} />
          결과 공개됨 · 수정 불가
        </div>
      )}

      <section className="scores-kpi-card">
        <div className="scores-kpi-card-title">반영 방식</div>
        <div className="scores-kpi-methods" role="radiogroup" aria-label="반영 방식">
          {(
            [
              ["가산", "점수 + (KPI − 기준값) × 계수"],
              ["배율", "점수 × (1 + (KPI − 기준값) × 계수 ÷ 100)"],
            ] as const
          ).map(([value, description]) => (
            <label
              key={value}
              className={`scores-kpi-method ${method === value ? "active" : ""}`}
            >
              <input
                type="radio"
                name="scores-kpi-method"
                value={value}
                checked={method === value}
                disabled={locked}
                onChange={() => setMethod(value)}
              />
              <span>
                <strong>{value}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>

        <div className="scores-kpi-inputs">
          <label>
            <span>기준값</span>
            <input
              type="number"
              inputMode="decimal"
              value={base}
              disabled={locked}
              onChange={(event) => setBase(event.target.value)}
            />
          </label>
          <label>
            <span>계수</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={factor}
              disabled={locked}
              onChange={(event) => setFactor(event.target.value)}
            />
          </label>
        </div>

        <div className="scores-kpi-preview" aria-live="polite">
          <span>계산 미리보기</span>
          <strong>
            {valid || (baseValue !== null && factorValue !== null)
              ? `개인 80점, 부서 KPI 90점이면 → ${applyKpi(80, 90, draftKpi)}점`
              : "기준값과 계수를 숫자로 입력해 주세요."}
          </strong>
        </div>
      </section>

      <section className="scores-kpi-card">
        <div className="scores-kpi-card-title">부서별 KPI 점수</div>
        <div className="scores-kpi-table-wrap">
          <table className="scores-kpi-table">
            <thead>
              <tr>
                <th>부서명</th>
                <th>인원</th>
                <th>KPI 점수</th>
                <th>반영 전 평균</th>
                <th>반영 후 평균</th>
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

      <button className="scores-kpi-save" type="button" disabled={locked} onClick={save}>
        저장
      </button>
    </div>
  )
}

export default ScoresKpi
