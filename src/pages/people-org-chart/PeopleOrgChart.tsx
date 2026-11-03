import { useEffect, useRef, useState } from "react"
import { Lock, Network, Search, X } from "lucide-react"
import { useNavigate } from "react-router"
import {
  departmentNames,
  positionNames,
  savePerson,
  useOrgState,
  type OrgChange,
  type OrgPerson,
} from "./org-store"
import "./people-org-chart.css"

const roleNames = { member: "팀원", leader: "팀장", executive: "임원" }
const groupNames = { production: "생산직", office: "관리직" }

// 직급이 높은 순 (목록 뒤쪽이 높은 직급)
const rankOf = (position: string) => positionNames.indexOf(position)
const byRankThenName = (a: OrgPerson, b: OrgPerson) =>
  rankOf(b.position) - rankOf(a.position) || a.name.localeCompare(b.name, "ko")

type Confirm = { title: string; text: string; status: OrgPerson["status"] } | null

function PeopleOrgChart() {
  const navigate = useNavigate()
  const { people, evaluationInProgress: locked } = useOrgState()
  const [search, setSearch] = useState("")
  const [showRetired, setShowRetired] = useState(false)
  const [selectedNo, setSelectedNo] = useState<string | null>(null)
  const [draft, setDraft] = useState<OrgChange | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [notice, setNotice] = useState<{ text: string; relation: boolean } | null>(null)
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  // 처음 열 때 조직도 가운데(임원 줄)가 보이게
  useEffect(() => {
    const box = scrollRef.current
    if (box) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
  }, [])

  const visible = people.filter((person) => showRetired || person.status === "active")
  const keyword = search.trim()
  const matches = keyword ? visible.filter((person) => person.name.includes(keyword)) : []
  const firstMatch = matches[0]?.employeeNo ?? null

  // 검색하면 첫 번째로 찾은 카드로 이동
  useEffect(() => {
    if (firstMatch) {
      cardRefs.current.get(firstMatch)?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" })
    }
  }, [firstMatch])

  const selected = people.find((person) => person.employeeNo === selectedNo) ?? null

  const open = (person: OrgPerson) => {
    setSelectedNo(person.employeeNo)
    setDraft({
      department: person.department,
      position: person.position,
      role: person.role,
      jobGroup: person.jobGroup,
      excluded: person.excluded,
      status: person.status,
    })
    setNotice(null)
  }
  const close = () => {
    setSelectedNo(null)
    setDraft(null)
  }

  const apply = (change: OrgChange, text: string) => {
    if (!selected) return
    const result = savePerson(selected.employeeNo, change)
    if (!result.saved) {
      setNotice({ text: "평가 중에는 조직도를 고칠 수 없습니다 (퇴사 처리만 가능).", relation: false })
      return
    }
    setNotice({ text, relation: result.relationChanged })
    close()
  }

  const executives = visible.filter((person) => person.role === "executive").sort(byRankThenName)
  const departments = departmentNames.map((name) => {
    const members = visible.filter((person) => person.role !== "executive" && person.department === name)
    const layers = [...positionNames]
      .reverse()
      .map((position) => ({
        position,
        people: members.filter((person) => person.position === position).sort(byRankThenName),
      }))
      .filter((layer) => layer.people.length)
    return {
      name,
      count: members.filter((person) => person.status === "active").length,
      layers,
    }
  })

  const card = (person: OrgPerson) => {
    const classes = [
      "people-org-chart-person",
      person.excluded ? "excluded" : "",
      person.status === "retired" ? "retired" : "",
      matches.some((match) => match.employeeNo === person.employeeNo) ? "found" : "",
      person.employeeNo === selectedNo ? "selected" : "",
    ].join(" ")
    return (
      <button
        key={person.employeeNo}
        type="button"
        className={classes}
        ref={(element) => {
          if (element) cardRefs.current.set(person.employeeNo, element)
          else cardRefs.current.delete(person.employeeNo)
        }}
        onClick={() => open(person)}
      >
        <strong>{person.name}</strong>
        <span>{person.position}</span>
        <span className="people-org-chart-badges">
          <span className={`people-org-chart-role ${person.role}`}>{roleNames[person.role]}</span>
          {person.excluded && <span className="people-org-chart-tag">평가 제외</span>}
          {person.status === "retired" && <span className="people-org-chart-tag">퇴사</span>}
        </span>
      </button>
    )
  }

  const departmentOptions = selected && !departmentNames.includes(selected.department)
    ? [selected.department, ...departmentNames]
    : departmentNames

  return (
    <div className="people-org-chart-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Network size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            조직도
          </div>
          <p>회사 전체를 직급 순으로 보고, 사람을 눌러 부서·직급·역할을 바꾸거나 퇴사 처리합니다.</p>
        </div>
      </div>

      {locked && (
        <div className="people-org-chart-locked">
          <Lock size={20} />
          평가 중에는 조직도를 고칠 수 없습니다 (퇴사 처리만 가능).
        </div>
      )}

      <div className="people-org-chart-tools">
        <label className="people-org-chart-search">
          <Search size={20} />
          <input
            type="search"
            placeholder="이름 검색"
            aria-label="이름 검색"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="people-org-chart-toggle">
          <input type="checkbox" checked={showRetired} onChange={(event) => setShowRetired(event.target.checked)} />
          퇴사자 보기
        </label>
        {keyword && (
          <span className="people-org-chart-found" role="status">
            {matches.length ? `${matches.length}명 찾음` : "찾는 이름이 없습니다"}
          </span>
        )}
      </div>

      {notice && (
        <div className={`people-org-chart-notice ${notice.relation ? "relation" : ""}`} role="status">
          <span>{notice.text}</span>
          {notice.relation && (
            <>
              <span>평가 관계에서 [규칙대로 다시 만들기]를 눌러 주세요.</span>
              <button type="button" className="people-org-chart-secondary" onClick={() => navigate("/admin/people/relations")}>
                평가 관계로
              </button>
            </>
          )}
        </div>
      )}

      {/* 조직도: 이 칸 안에서만 옆으로 밀린다 */}
      <div className="people-org-chart-scroll" ref={scrollRef}>
        <div className="people-org-chart-tree">
          <section className="people-org-chart-top">
            <div className="people-org-chart-level-title">임원</div>
            <div className="people-org-chart-row">{executives.map(card)}</div>
          </section>

          <div className="people-org-chart-departments">
            {departments.map((department) => (
              <section key={department.name} className="people-org-chart-department">
                <div className="people-org-chart-department-head">
                  <strong>{department.name}</strong>
                  <span>{`${department.count}명`}</span>
                </div>
                {department.layers.map((layer) => (
                  <div key={layer.position} className="people-org-chart-layer">
                    <div className="people-org-chart-layer-name">{layer.position}</div>
                    <div className="people-org-chart-row">{layer.people.map(card)}</div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>

      {selected && draft && (
        <>
          <div className="people-org-chart-backdrop" onClick={close} />
          <aside className="people-org-chart-panel" aria-label={`${selected.name} 편집`}>
            <div className="people-org-chart-panel-head">
              <div>
                <strong>{selected.name}</strong>
                <span>{`사번 ${selected.employeeNo}`}</span>
              </div>
              <button type="button" className="people-org-chart-close" aria-label="닫기" onClick={close}>
                <X size={22} />
              </button>
            </div>

            {locked && <p className="people-org-chart-panel-locked">평가 중에는 조직도를 고칠 수 없습니다 (퇴사 처리만 가능).</p>}

            <label>
              <span>부서</span>
              <select
                value={draft.department}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, department: event.target.value })}
              >
                {departmentOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>직급</span>
              <select
                value={draft.position}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, position: event.target.value })}
              >
                {[...positionNames].reverse().map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>역할</span>
              <select
                value={draft.role}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, role: event.target.value as OrgPerson["role"] })}
              >
                {(Object.keys(roleNames) as OrgPerson["role"][]).map((role) => (
                  <option key={role} value={role}>
                    {roleNames[role]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>직군</span>
              <select
                value={draft.jobGroup}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, jobGroup: event.target.value as OrgPerson["jobGroup"] })}
              >
                {(Object.keys(groupNames) as OrgPerson["jobGroup"][]).map((group) => (
                  <option key={group} value={group}>
                    {groupNames[group]}
                  </option>
                ))}
              </select>
            </label>
            <label className="people-org-chart-check">
              <input
                type="checkbox"
                checked={draft.excluded}
                disabled={locked}
                onChange={(event) => setDraft({ ...draft, excluded: event.target.checked })}
              />
              평가 제외 (6개월 미만 등)
            </label>

            <div className="people-org-chart-panel-buttons">
              <button type="button" className="people-org-chart-secondary" onClick={close}>
                취소
              </button>
              <button
                type="button"
                className="people-org-chart-primary"
                disabled={locked}
                onClick={() => apply(draft, `${selected.name}님 정보를 저장했습니다.`)}
              >
                저장
              </button>
            </div>

            <button
              type="button"
              className={selected.status === "active" ? "people-org-chart-danger" : "people-org-chart-secondary"}
              onClick={() =>
                setConfirm(
                  selected.status === "active"
                    ? {
                        title: "퇴사 처리할까요?",
                        text: `${selected.name}님을 퇴사 처리합니다. 삭제하지 않고 평가 기록은 남깁니다. 조직도에서는 숨겨지고 로그인할 수 없게 됩니다.`,
                        status: "retired",
                      }
                    : {
                        title: "재직으로 되돌릴까요?",
                        text: `${selected.name}님을 다시 재직 상태로 되돌립니다.`,
                        status: "active",
                      },
                )
              }
            >
              {selected.status === "active" ? "퇴사 처리" : "재직으로 되돌리기"}
            </button>
          </aside>
        </>
      )}

      {confirm && selected && (
        <div className="people-org-chart-overlay" role="dialog" aria-modal="true" aria-labelledby="people-org-chart-confirm-title">
          <div className="people-org-chart-confirm">
            <div id="people-org-chart-confirm-title" className="people-org-chart-confirm-title">
              {confirm.title}
            </div>
            <p>{confirm.text}</p>
            <div className="people-org-chart-confirm-buttons">
              <button type="button" className="people-org-chart-secondary" onClick={() => setConfirm(null)}>
                취소
              </button>
              <button
                type="button"
                className={confirm.status === "retired" ? "people-org-chart-danger" : "people-org-chart-primary"}
                onClick={() => {
                  apply(
                    { ...(locked ? selected : (draft ?? selected)), status: confirm.status },
                    confirm.status === "retired"
                      ? `${selected.name}님을 퇴사 처리했습니다. [퇴사자 보기]로 다시 볼 수 있습니다.`
                      : `${selected.name}님을 재직으로 되돌렸습니다.`,
                  )
                  setConfirm(null)
                }}
              >
                {confirm.status === "retired" ? "퇴사 처리" : "되돌리기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PeopleOrgChart
