import { useState } from "react"
import { BarChart3, Lock, Search } from "lucide-react"
import { evaluationSetting, stageFieldScores } from "@/data/scores"
import {
  departmentNames,
  filterAndSort,
  isValidWeights,
  personByNo,
  saveWeights,
  scoreResults,
  sortOptions,
  useScoreState,
  type SortKey,
} from "@/data/scores-store"
import { round1, type ScoreResult, type StageKey, type Weights } from "@/lib/scoring"
import "./scores-results.css"

const roleNames = { member: "팀원", leader: "팀장" }

// 역할마다 받는 단계: 팀원 자기·팀장·임원 / 팀장 자기·임원·상향
const stagesOf = (role: ScoreResult["role"]): StageKey[] =>
  role === "member" ? ["self", "leader", "executive"] : ["self", "executive", "upward"]

const stageColumns: { key: StageKey; label: string }[] = [
  { key: "self", label: "자기" },
  { key: "leader", label: "팀장" },
  { key: "executive", label: "임원" },
  { key: "upward", label: "상향" },
]

// 가중치 입력 칸: [역할, 단계, 이름]
const weightFields = [
  ["member", "self", "자기"],
  ["member", "leader", "팀장"],
  ["member", "executive", "임원"],
  ["leader", "self", "자기"],
  ["leader", "executive", "임원"],
  ["leader", "upward", "상향 반영 비율"],
] as const

type WeightText = Record<string, string> // "member.self" → 입력 글자

const toWeightText = (weights: Weights): WeightText =>
  Object.fromEntries(
    weightFields.map(([role, stage]) => [
      `${role}.${stage}`,
      String((weights[role] as Record<string, number>)[stage]),
    ]),
  )

const fromWeightText = (text: WeightText): Weights => {
  const value = (key: string) => (text[key].trim() === "" ? NaN : Number(text[key]))
  return {
    member: {
      self: value("member.self"),
      leader: value("member.leader"),
      executive: value("member.executive"),
    },
    leader: {
      self: value("leader.self"),
      executive: value("leader.executive"),
      upward: value("leader.upward"),
    },
  }
}

// 받는 단계 중 제출된 단계 수 (상향은 한 명이라도 제출하면 제출로 센다)
function submittedCount(results: ScoreResult[]) {
  let submitted = 0
  let total = 0
  for (const result of results) {
    for (const stage of stagesOf(result.role)) {
      total++
      if (stageFieldScores[result.employeeNo]?.[stage]) submitted++
    }
  }
  return { submitted, total }
}

function ScoresResults() {
  const store = useScoreState()
  const locked = store.resultPublished
  const [department, setDepartment] = useState("전체")
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<SortKey>("department")
  const [weightText, setWeightText] = useState<WeightText>(() => toWeightText(store.weights))
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const results = scoreResults(store)
  const shown = filterAndSort(results, { department, search, sort })
  const count = submittedCount(results)

  const draftWeights = fromWeightText(weightText)
  const memberSum = draftWeights.member.self + draftWeights.member.leader + draftWeights.member.executive
  const leaderSum = draftWeights.leader.self + draftWeights.leader.executive
  const weightsValid = isValidWeights(draftWeights)

  const save = () => {
    if (!weightsValid) {
      setMessage({ ok: false, text: "팀원 합계와 팀장 합계가 각각 100이어야 하고, 상향 반영 비율은 0~100이어야 합니다." })
      return
    }
    setMessage(
      saveWeights(draftWeights)
        ? { ok: true, text: "저장했습니다. 아래 표가 새 가중치로 다시 계산되었습니다." }
        : { ok: false, text: "결과가 공개되어 수정할 수 없습니다." },
    )
  }

  const weightInput = (role: "member" | "leader", stage: string, label: string) => {
    const key = `${role}.${stage}`
    return (
      <label key={key}>
        <span>{label}</span>
        <input
          type="number"
          inputMode="numeric"
          aria-label={`${role === "member" ? "팀원" : "팀장"} ${label}`}
          value={weightText[key]}
          disabled={locked}
          onChange={(event) => setWeightText({ ...weightText, [key]: event.target.value })}
        />
        <small>%</small>
      </label>
    )
  }

  return (
    <div className="scores-results-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <BarChart3 size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            평가 결과
          </div>
          <p>가중 합산 → KPI 반영 → 보정 → 등급 순서로 계산한 결과입니다.</p>
        </div>
      </div>

      {locked && (
        <div className="scores-results-locked">
          <Lock size={20} />
          결과 공개됨 · 수정 불가
        </div>
      )}

      <section className="scores-results-summary">
        <div>
          <span>회차</span>
          <strong>{evaluationSetting.name}</strong>
        </div>
        <div>
          <span>상태</span>
          <strong>{evaluationSetting.status}</strong>
        </div>
        <div>
          <span>제출 현황 (단계)</span>
          <strong>{`제출 ${count.submitted} / 전체 ${count.total}`}</strong>
        </div>
      </section>

      <section className="scores-results-weights">
        <div className="scores-results-weights-title">가중치</div>
        <div className="scores-results-weight-group">
          <div className="scores-results-weight-head">
            <strong>팀원</strong>
            <span className={memberSum === 100 ? "ok" : "error"}>{`합계 ${Number.isFinite(memberSum) ? memberSum : "-"}%`}</span>
          </div>
          <div className="scores-results-weight-inputs">
            {weightFields.slice(0, 3).map(([role, stage, label]) => weightInput(role, stage, label))}
          </div>
        </div>
        <div className="scores-results-weight-group">
          <div className="scores-results-weight-head">
            <strong>팀장</strong>
            <span className={leaderSum === 100 ? "ok" : "error"}>{`자기+임원 합계 ${Number.isFinite(leaderSum) ? leaderSum : "-"}%`}</span>
          </div>
          <div className="scores-results-weight-inputs">
            {weightFields.slice(3).map(([role, stage, label]) => weightInput(role, stage, label))}
          </div>
          <p className="scores-results-weight-note">
            팀장 최종 = (자기·임원 가중 합) × (100 − 상향 반영 비율)% + 상향 점수 × 상향 반영 비율%
          </p>
        </div>
        {message && (
          <p className={`scores-results-message ${message.ok ? "ok" : "error"}`} role="status">
            {message.text}
          </p>
        )}
        <button className="scores-results-save" type="button" disabled={locked} onClick={save}>
          가중치 저장
        </button>
      </section>

      <div className="scores-results-filter" role="group" aria-label="부서 선택">
        {["전체", ...departmentNames].map((name) => (
          <button
            key={name}
            type="button"
            className={department === name ? "active" : ""}
            aria-pressed={department === name}
            onClick={() => setDepartment(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="scores-results-tools">
        <label className="scores-results-search">
          <Search size={20} />
          <input
            type="search"
            placeholder="이름 검색"
            aria-label="이름 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="scores-results-sort">
          <span>정렬</span>
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="scores-results-table-wrap">
        <table className="scores-results-table">
          <thead>
            <tr>
              <th>이름</th>
              <th>부서</th>
              <th>직급</th>
              <th>역할</th>
              {stageColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
              <th>가중 합산</th>
              <th>KPI 반영</th>
              <th>최종</th>
              <th>등급</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((result) => {
              const person = personByNo.get(result.employeeNo)
              const weighted = round1(result.weighted)
              const change = round1(result.kpiApplied - weighted)
              return (
                <tr key={result.employeeNo}>
                  <td className="scores-results-name">{person?.name}</td>
                  <td>{result.department}</td>
                  <td>{person?.position}</td>
                  <td>{roleNames[result.role]}</td>
                  {stageColumns.map((column) => {
                    if (!stagesOf(result.role).includes(column.key)) {
                      return (
                        <td key={column.key} className="scores-results-none">
                          —
                        </td>
                      )
                    }
                    const score = result.stages[column.key]
                    return score === null ? (
                      <td key={column.key} className="scores-results-missing">
                        미제출(0)
                      </td>
                    ) : (
                      <td key={column.key}>{round1(score)}</td>
                    )
                  })}
                  <td>{weighted}</td>
                  <td>
                    {result.kpiApplied}
                    <span
                      className={`scores-results-change ${change > 0 ? "up" : change < 0 ? "down" : ""}`}
                    >
                      {change > 0 ? ` ▲${change}` : change < 0 ? ` ▼${-change}` : " –"}
                    </span>
                  </td>
                  <td className="scores-results-final">
                    {result.final}
                    {result.adjustment !== null && (
                      <span className="scores-results-adjusted">보정</span>
                    )}
                  </td>
                  <td className="scores-results-grade">{result.grade}</td>
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td className="scores-results-empty" colSpan={12}>
                  찾는 이름이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ScoresResults
