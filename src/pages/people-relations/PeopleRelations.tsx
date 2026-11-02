import { useCallback, useEffect, useState } from "react"
import { ChevronDown, Lock, Network, Plus, Search, X } from "lucide-react"
import {
  emptyRelation,
  isAdminSession,
  loadCases,
  loadCycles,
  loadEmployees,
  loadRules,
  regenerateCases,
  relationsOf,
  sameRelation,
  saveRelations,
  type CaseRow,
  type Cycle,
  type Employee,
  type Relation,
} from "./relations-api"
import "./people-relations.css"

const statusNames = { before: "평가 전", in_progress: "평가 중", done: "평가 완료" }
const roleNames = { member: "팀원", leader: "팀장", executive: "임원" }

type Message = { ok: boolean; text: string } | null
type Confirm = "regenerate" | null

function PeopleRelations() {
  const [ready, setReady] = useState<"checking" | "no-login" | "ok">("checking")
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [cycleId, setCycleId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [cases, setCases] = useState<CaseRow[]>([])
  const [rules, setRules] = useState<Map<number, Relation>>(new Map())
  const [drafts, setDrafts] = useState<Map<number, Relation>>(new Map())
  const [department, setDepartment] = useState("전체")
  const [search, setSearch] = useState("")
  const [adding, setAdding] = useState<Record<number, string>>({})
  const [showOthers, setShowOthers] = useState(false)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<Message>(null)

  // 회차·직원·규칙은 처음 한 번, 평가 건은 회차를 고를 때마다 읽는다
  useEffect(() => {
    let active = true
    ;(async () => {
      if (!(await isAdminSession())) {
        if (active) setReady("no-login")
        return
      }
      try {
        const [cycleList, employeeList, ruleRows] = await Promise.all([
          loadCycles(),
          loadEmployees(),
          loadRules(),
        ])
        if (!active) return
        setCycles(cycleList)
        setEmployees(employeeList)
        setRules(relationsOf(ruleRows))
        setCycleId(cycleList[0]?.id ?? null)
        setReady("ok")
      } catch (error) {
        if (active) {
          setMessage({ ok: false, text: `불러오지 못했습니다: ${(error as Error).message}` })
          setReady("ok")
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const reloadCases = useCallback(async (id: number) => {
    const rows = await loadCases(id)
    setCases(rows)
    setDrafts(new Map())
  }, [])

  useEffect(() => {
    if (cycleId !== null) {
      reloadCases(cycleId).catch((error) =>
        setMessage({ ok: false, text: `평가 건을 불러오지 못했습니다: ${(error as Error).message}` }),
      )
    }
  }, [cycleId, reloadCases])

  if (ready === "checking") {
    return <p className="people-relations-notice">불러오는 중입니다…</p>
  }
  if (ready === "no-login") {
    return (
      <div className="people-relations-page">
        <Heading />
        <p className="people-relations-notice">
          이 화면은 실제 관리자 로그인이 필요합니다. 로그아웃한 뒤 "관리자 로그인"으로 들어와 주세요.
          (역할 미리보기로는 저장소의 평가 관계를 볼 수 없습니다)
        </p>
      </div>
    )
  }

  const cycle = cycles.find((item) => item.id === cycleId) ?? null
  const editable = cycle?.status === "before"
  const byId = new Map(employees.map((employee) => [employee.id, employee]))
  const nameOf = (id: number | null) => (id === null ? "" : byId.get(id)?.name ?? "")
  const departments = [...new Set(employees.map((employee) => employee.department))]

  const isTarget = (employee: Employee) =>
    (employee.role === "member" || employee.role === "leader") &&
    employee.status === "active" &&
    !employee.excluded
  const targets = employees.filter(isTarget)
  const others = employees.filter(
    (employee) => !isTarget(employee) && (employee.excluded || employee.status === "retired"),
  )
  const evaluators = employees
    .filter((employee) => employee.status === "active")
    .sort(
      (a, b) =>
        departments.indexOf(a.department) - departments.indexOf(b.department) ||
        a.name.localeCompare(b.name, "ko"),
    )

  const saved = relationsOf(cases)
  const relationOf = (id: number) => drafts.get(id) ?? saved.get(id) ?? emptyRelation
  const hasSelf = (id: number) => cases.some((row) => row.target_id === id && row.stage === "self")
  // 답이 있는 평가 건 (평가자를 바꾸거나 지울 수 없음)
  const answered = (targetId: number, stage: string, evaluatorId: number | null) =>
    cases.some(
      (row) =>
        row.target_id === targetId &&
        row.stage === stage &&
        row.evaluator_id === evaluatorId &&
        row.hasAnswers,
    )

  const changed = [...drafts.entries()].filter(
    ([id, relation]) => !sameRelation(relation, saved.get(id) ?? emptyRelation),
  )

  const setDraft = (id: number, next: Relation) => {
    const copy = new Map(drafts)
    copy.set(id, next)
    setDrafts(copy)
    setMessage(null)
  }

  const shown = targets
    .filter((employee) => department === "전체" || employee.department === department)
    .filter((employee) => !search.trim() || employee.name.includes(search.trim()))
    .sort(
      (a, b) =>
        departments.indexOf(a.department) - departments.indexOf(b.department) ||
        (a.role === b.role ? 0 : a.role === "leader" ? -1 : 1) ||
        a.name.localeCompare(b.name, "ko"),
    )

  const run = async (work: () => Promise<string>) => {
    setBusy(true)
    setMessage(null)
    try {
      const text = await work()
      setMessage({ ok: true, text })
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message })
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const save = () =>
    run(async () => {
      const count = await saveRelations(
        cycle!.id,
        changed.map(([id, relation]) => ({ target_id: id, ...relation })),
      )
      await reloadCases(cycle!.id)
      return `저장했습니다. 평가 건 ${count}건을 고쳤습니다.`
    })

  const regenerate = () =>
    run(async () => {
      const result = await regenerateCases(cycle!.id)
      await reloadCases(cycle!.id)
      return `규칙대로 다시 만들었습니다. (지움 ${result.deleted}건 · 만듦 ${result.created}건)`
    })

  return (
    <div className="people-relations-page">
      <Heading />

      <section className="people-relations-cycle">
        <label>
          <span>회차</span>
          <select
            value={cycleId ?? ""}
            onChange={(event) => setCycleId(Number(event.target.value))}
            disabled={busy}
          >
            {cycles.map((item) => (
              <option key={item.id} value={item.id}>
                {`${item.id}회차 · ${item.name}`}
              </option>
            ))}
          </select>
        </label>
        {cycle && (
          <span className={`people-relations-status ${cycle.status}`}>{statusNames[cycle.status]}</span>
        )}
      </section>

      {cycle && !editable && (
        <div className="people-relations-locked">
          <Lock size={20} />
          평가가 시작되어 수정할 수 없습니다.
        </div>
      )}

      <div className="people-relations-tools">
        <div className="people-relations-filter" role="group" aria-label="부서 선택">
          {["전체", ...departments.filter((name) => targets.some((t) => t.department === name))].map((name) => (
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
        <label className="people-relations-search">
          <Search size={20} />
          <input
            type="search"
            placeholder="이름 검색"
            aria-label="이름 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="people-relations-table-wrap">
        <table className="people-relations-table">
          <thead>
            <tr>
              <th>평가 대상</th>
              <th>부서·직급·역할</th>
              <th>자기평가</th>
              <th>팀장 평가자</th>
              <th>임원 평가자</th>
              <th>상향 평가자 (팀장만)</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((target) => {
              const relation = relationOf(target.id)
              const differs = !sameRelation(relation, rules.get(target.id) ?? emptyRelation)
              const isChanged = changed.some(([id]) => id === target.id)
              const options = evaluators.filter((employee) => employee.id !== target.id)
              const evaluatorSelect = (stage: "leader" | "executive") => {
                const locked = !editable || answered(target.id, stage, relation[stage])
                return (
                  <div className="people-relations-cell">
                    <select
                      aria-label={`${target.name} ${stage === "leader" ? "팀장" : "임원"} 평가자`}
                      value={relation[stage] ?? ""}
                      disabled={locked || busy}
                      onChange={(event) =>
                        setDraft(target.id, {
                          ...relation,
                          [stage]: event.target.value ? Number(event.target.value) : null,
                        })
                      }
                    >
                      <option value="">없음</option>
                      {options.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {`${employee.name} (${employee.department}·${employee.position})`}
                        </option>
                      ))}
                    </select>
                    {editable && answered(target.id, stage, relation[stage]) && (
                      <small className="people-relations-answered">답 있음</small>
                    )}
                  </div>
                )
              }
              return (
                <tr
                  key={target.id}
                  className={`${differs ? "people-relations-row-differs" : ""} ${isChanged ? "people-relations-row-changed" : ""}`}
                >
                  <td className="people-relations-name">
                    {target.name}
                    {differs && <span className="people-relations-differs">규칙과 다름</span>}
                    {isChanged && <span className="people-relations-unsaved">저장 전</span>}
                  </td>
                  <td className="people-relations-meta">
                    <span>{target.department}</span>
                    <span>{target.position}</span>
                    <span>{roleNames[target.role]}</span>
                  </td>
                  <td>{hasSelf(target.id) ? "있음" : "없음"}</td>
                  <td>{target.role === "member" ? evaluatorSelect("leader") : <span className="people-relations-none">—</span>}</td>
                  <td>{evaluatorSelect("executive")}</td>
                  <td>
                    {target.role === "leader" ? (
                      <div className="people-relations-chips">
                        {relation.upward.map((id) => {
                          const locked = !editable || answered(target.id, "upward", id)
                          return (
                            <span key={id} className="people-relations-chip">
                              {nameOf(id)}
                              {!locked && (
                                <button
                                  type="button"
                                  aria-label={`${nameOf(id)} 상향 평가자 빼기`}
                                  disabled={busy}
                                  onClick={() =>
                                    setDraft(target.id, {
                                      ...relation,
                                      upward: relation.upward.filter((item) => item !== id),
                                    })
                                  }
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </span>
                          )
                        })}
                        {editable && (
                          <span className="people-relations-add">
                            <select
                              aria-label={`${target.name} 상향 평가자 추가할 사람`}
                              value={adding[target.id] ?? ""}
                              disabled={busy}
                              onChange={(event) => setAdding({ ...adding, [target.id]: event.target.value })}
                            >
                              <option value="">추가할 사람</option>
                              {options
                                .filter((employee) => !relation.upward.includes(employee.id))
                                .map((employee) => (
                                  <option key={employee.id} value={employee.id}>
                                    {`${employee.name} (${employee.department})`}
                                  </option>
                                ))}
                            </select>
                            <button
                              type="button"
                              disabled={!adding[target.id] || busy}
                              onClick={() => {
                                setDraft(target.id, {
                                  ...relation,
                                  upward: [...relation.upward, Number(adding[target.id])],
                                })
                                setAdding({ ...adding, [target.id]: "" })
                              }}
                            >
                              <Plus size={18} />
                              추가
                            </button>
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="people-relations-none">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td className="people-relations-empty" colSpan={6}>
                  찾는 이름이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="people-relations-others">
        <button type="button" aria-expanded={showOthers} onClick={() => setShowOthers(!showOthers)}>
          {`평가 대상 아님 ${others.length}명`}
          <ChevronDown size={20} />
        </button>
        {showOthers && (
          <ul>
            {others.map((employee) => (
              <li key={employee.id}>
                {`${employee.name} (${employee.department} · ${employee.position}) — ${
                  employee.status === "retired" ? "퇴사" : "평가 제외"
                }`}
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && (
        <p className={`people-relations-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      {editable && (
          <div className="people-relations-actions">
            <button
              type="button"
              className="people-relations-secondary"
              disabled={busy}
              onClick={() => setConfirm("regenerate")}
            >
              규칙대로 다시 만들기
            </button>
            <button
              type="button"
              className="people-relations-primary"
              disabled={busy || !changed.length}
              onClick={save}
            >
              {changed.length ? `저장 (${changed.length}명)` : "저장"}
            </button>
          </div>
      )}

      {confirm && (
        <div className="people-relations-overlay" role="dialog" aria-modal="true" aria-labelledby="people-relations-confirm-title">
          <div className="people-relations-confirm">
            <div id="people-relations-confirm-title" className="people-relations-confirm-title">
              규칙대로 다시 만들까요?
            </div>
            <p>고친 내용이 모두 사라집니다. 답이 있는 평가 건은 그대로 둡니다.</p>
            <div className="people-relations-confirm-buttons">
              <button type="button" className="people-relations-secondary" disabled={busy} onClick={() => setConfirm(null)}>
                취소
              </button>
              <button
                type="button"
                className="people-relations-primary"
                disabled={busy}
                onClick={regenerate}
              >
                다시 만들기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Heading() {
  return (
    <div className="detail-heading">
      <div className="detail-heading-icon">
        <Network size={30} strokeWidth={1.8} />
      </div>
      <div>
        <div className="detail-area">관리자 영역</div>
        <div className="detail-title" role="heading" aria-level={1}>
          평가 관계
        </div>
        <p>평가를 시작하기 전에 누가 누구를 어느 단계로 평가하는지 확인하고 고칩니다.</p>
      </div>
    </div>
  )
}

export default PeopleRelations
