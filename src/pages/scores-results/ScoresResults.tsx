import { useState } from "react"
import { BarChart3, Lock, Search } from "lucide-react"
import { evaluationSetting, stageFieldScores } from "@/data/scores"
import {
  departmentNames,
  filterAndSort,
  isValidMixRatio,
  isValidWeights,
  personByNo,
  saveRatios,
  scoreResults,
  sortOptions,
  useScoreState,
  type SortKey,
} from "@/data/scores-store"
import { round1, type MixRatio, type ScoreResult, type StageKey, type Weights } from "@/lib/scoring"
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

// 비율 입력 칸: [묶음, 역할, 칸, 이름]
// w = 개인 평가의 단계 비율 / m = 최종 점수 비율 (개인 평가·부서 KPI·상향 평가)
type RatioField = readonly ["w" | "m", "member" | "leader", string, string]
const ratioGroups: { title: string; note: string; fields: RatioField[] }[] = [
  {
    title: "팀원 개인 평가",
    note: "단계 합계",
    fields: [
      ["w", "member", "self", "자기"],
      ["w", "member", "leader", "팀장"],
      ["w", "member", "executive", "임원"],
    ],
  },
  {
    title: "팀장 개인 평가",
    note: "단계 합계",
    fields: [
      ["w", "leader", "self", "자기"],
      ["w", "leader", "executive", "임원"],
    ],
  },
  {
    title: "팀원 최종 점수",
    note: "합계",
    fields: [
      ["m", "member", "personal", "개인 평가"],
      ["m", "member", "kpi", "부서 KPI"],
    ],
  },
  {
    title: "팀장 최종 점수",
    note: "합계",
    fields: [
      ["m", "leader", "personal", "개인 평가"],
      ["m", "leader", "kpi", "부서 KPI"],
      ["m", "leader", "upward", "상향 평가"],
    ],
  },
]

type RatioText = Record<string, string> // "w.member.self" → 입력 글자
const keyOf = ([group, role, field]: RatioField) => `${group}.${role}.${field}`

const toRatioText = (weights: Weights, mix: MixRatio): RatioText =>
  Object.fromEntries(
    ratioGroups.flatMap((group) =>
      group.fields.map((field) => {
        const source = (field[0] === "w" ? weights : mix)[field[1]] as Record<string, number>
        return [keyOf(field), String(source[field[2]])]
      }),
    ),
  )

const fromRatioText = (text: RatioText) => {
  const value = (key: string) => (text[key].trim() === "" ? NaN : Number(text[key]))
  const weights: Weights = {
    member: {
      self: value("w.member.self"),
      leader: value("w.member.leader"),
      executive: value("w.member.executive"),
    },
    leader: { self: value("w.leader.self"), executive: value("w.leader.executive") },
  }
  const mix: MixRatio = {
    member: { personal: value("m.member.personal"), kpi: value("m.member.kpi") },
    leader: {
      personal: value("m.leader.personal"),
      kpi: value("m.leader.kpi"),
      upward: value("m.leader.upward"),
    },
  }
  return { weights, mix }
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
  const [ratioText, setRatioText] = useState<RatioText>(() => toRatioText(store.weights, store.mix))
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const results = scoreResults(store)
  const shown = filterAndSort(results, { department, search, sort })
  const count = submittedCount(results)

  const draft = fromRatioText(ratioText)
  const sumOf = (fields: RatioField[]) =>
    fields.reduce((total, field) => total + Number(ratioText[keyOf(field)] || NaN), 0)
  const ratiosValid = isValidWeights(draft.weights) && isValidMixRatio(draft.mix)

  const save = () => {
    if (!ratiosValid) {
      setMessage({ ok: false, text: "네 묶음의 합계가 각각 100이어야 하고, 칸마다 0~100이어야 합니다." })
      return
    }
    setMessage(
      saveRatios(draft.weights, draft.mix)
        ? { ok: true, text: "저장했습니다. 아래 표가 새 비율로 다시 계산되었습니다." }
        : { ok: false, text: "결과가 확정되어 수정할 수 없습니다." },
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
          <p>개인 평가(단계 가중 합산) → 부서 KPI·상향 평가와 비율로 섞기 → 보정 순서로 계산한 최종 점수입니다.</p>
        </div>
      </div>

      {locked && (
        <div className="scores-results-locked">
          <Lock size={20} />
          결과 확정됨 · 수정 불가
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
        <div className="scores-results-weights-title">비율</div>
        {ratioGroups.map((group) => {
          const sum = sumOf(group.fields)
          return (
            <div key={group.title} className="scores-results-weight-group">
              <div className="scores-results-weight-head">
                <strong>{group.title}</strong>
                <span className={sum === 100 ? "ok" : "error"}>{`${group.note} ${Number.isFinite(sum) ? sum : "-"}%`}</span>
              </div>
              <div className="scores-results-weight-inputs">
                {group.fields.map((field) => (
                  <label key={keyOf(field)}>
                    <span>{field[3]}</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      aria-label={`${group.title} ${field[3]}`}
                      value={ratioText[keyOf(field)]}
                      disabled={locked}
                      onChange={(event) => setRatioText({ ...ratioText, [keyOf(field)]: event.target.value })}
                    />
                    <small>%</small>
                  </label>
                ))}
              </div>
            </div>
          )
        })}
        <p className="scores-results-weight-note">
          팀원 최종 = 개인 평가 × 개인% + 부서 KPI × KPI% / 팀장 최종 = 개인 평가 × 개인% + 부서 KPI × KPI% + 상향 평가 × 상향%
        </p>
        {message && (
          <p className={`scores-results-message ${message.ok ? "ok" : "error"}`} role="status">
            {message.text}
          </p>
        )}
        <button className="scores-results-save" type="button" disabled={locked} onClick={save}>
          비율 저장
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
              <th>개인 평가</th>
              <th>비율 반영</th>
              <th>최종</th>
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
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td className="scores-results-empty" colSpan={11}>
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
