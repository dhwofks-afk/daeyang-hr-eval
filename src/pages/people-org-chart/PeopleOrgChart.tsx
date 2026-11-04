import { useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Lock, Network, Search, X } from "lucide-react"
import { useNavigate } from "react-router"
import { currentRound, useDesignState } from "@/data/design"
import {
  savePerson,
  useOrgConnection,
  useOrgState,
  type OrgChange,
  type OrgPerson,
} from "./org-store"
import "./people-org-chart.css"

const roleNames = { member: "팀원", leader: "팀장", executive: "임원" }

type Confirm = { title: string; text: string; status: OrgPerson["status"] } | null

function PeopleOrgChart() {
  const navigate = useNavigate()
  useOrgConnection()
  const org = useOrgState()
  const design = useDesignState()
  const { people, positionNames } = org
  const ready = org.source === "fake" || org.source === "server"
  // 평가 중이면 퇴사 처리만: 저장소는 지금 회차 상태, 가짜 데이터는 평가 설계(가짜) 회차 상태
  const locked = org.source === "server" ? org.evaluationInProgress : currentRound(design).status === "평가 중"
  const departmentNames = org.departments.map((department) => department.name)
  const [saving, setSaving] = useState(false)

  // 직급이 높은 순 (목록 뒤쪽이 높은 직급)
  const rankOf = (position: string) => positionNames.indexOf(position)
  const byRankThenName = (a: OrgPerson, b: OrgPerson) =>
    rankOf(b.position) - rankOf(a.position) || a.name.localeCompare(b.name, "ko")
  const [search, setSearch] = useState("")
  const [showRetired, setShowRetired] = useState(false)
  const [selectedNo, setSelectedNo] = useState<string | null>(null)
  const [draft, setDraft] = useState<OrgChange | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [notice, setNotice] = useState<{ text: string; relation: boolean } | null>(null)
  // 펼친 부서 (처음엔 모두 접힘). 검색하면 찾은 사람의 부서는 저절로 펼친다
  const [expanded, setExpanded] = useState<string[]>([])
  const cardRefs = useRef(new Map<string, HTMLButtonElement>())
  const scrollRef = useRef<HTMLDivElement>(null)

  // 처음 열 때(저장소면 다 읽은 뒤) 조직도 가운데(대표이사 줄)가 보이게
  useEffect(() => {
    const box = scrollRef.current
    if (box && ready) box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2
  }, [ready])

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
      excluded: person.excluded,
      status: person.status,
    })
    setNotice(null)
  }
  const close = () => {
    setSelectedNo(null)
    setDraft(null)
  }

  // 저장소면 저장이 끝날 때까지 기다린다 (그동안 버튼 잠금)
  const apply = async (change: OrgChange, text: string) => {
    if (!selected || saving) return
    setSaving(true)
    const result = await savePerson(selected.employeeNo, change, locked)
    setSaving(false)
    if (!result.saved) {
      setNotice({ text: result.problem ?? "저장하지 못했습니다.", relation: false })
      return
    }
    setNotice({ text, relation: result.relationChanged })
    close()
  }

  // 맨 위: 대표이사 · 부사장 (직급으로 찾는다. 없으면 직함 카드만)
  const topPositions = ["대표이사", "부사장"]
  const ceo = visible.filter((person) => person.position === "대표이사").sort(byRankThenName)
  const vp = visible.filter((person) => person.position === "부사장").sort(byRankThenName)

  // 본부: 부서 번호 순으로 처음 나오는 순서
  const headquarterNames = [
    ...new Set(org.departments.flatMap((department) => (department.headquarters ? [department.headquarters] : []))),
  ]
  const executives = visible
    .filter((person) => person.role === "executive" && !topPositions.includes(person.position))
    .sort(byRankThenName)
  const executivesOf = (headquarters: string) => executives.filter((person) => person.headquarters === headquarters)
  // 본부 없는 임원 (본부 칸이 비었거나 없는 본부) → 부사장 옆 본부 없는 부서 쪽
  const noHqExecutives = executives.filter(
    (person) => !person.headquarters || !headquarterNames.includes(person.headquarters),
  )

  const departments = departmentNames.map((name) => {
    const members = visible.filter(
      (person) => person.role !== "executive" && !topPositions.includes(person.position) && person.department === name,
    )
    const layers = [...positionNames]
      .reverse()
      .map((position) => ({
        position,
        people: members.filter((person) => person.position === position).sort(byRankThenName),
      }))
      .filter((layer) => layer.people.length)
    return {
      name,
      headquarters: org.departments.find((department) => department.name === name)?.headquarters ?? null,
      count: members.filter((person) => person.status === "active").length,
      layers,
    }
  })
  // 본부 안 부서는 가나다순
  const departmentsOf = (headquarters: string) =>
    departments
      .filter((department) => department.headquarters === headquarters)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
  const noHqDepartments = departments.filter(
    (department) => !department.headquarters || !headquarterNames.includes(department.headquarters),
  )
  // 본부 없는 부서는 부사장 양옆으로 반씩 (앞쪽 = 왼쪽)
  const leftDepartments = noHqDepartments.slice(0, Math.ceil(noHqDepartments.length / 2))
  const rightDepartments = noHqDepartments.slice(Math.ceil(noHqDepartments.length / 2))
  // 본부 없는 임원은 본부 없는 부서의 "담당 임원"으로 보인다
  // (자기 부서가 본부 없는 부서면 그 부서, 아니면 첫 번째 본부 없는 부서)
  const noHqDepartmentOf = (person: OrgPerson) =>
    noHqDepartments.some((department) => department.name === person.department)
      ? person.department
      : (noHqDepartments[0]?.name ?? null)
  const executivesOfDepartment = (name: string) =>
    noHqExecutives.filter((person) => noHqDepartmentOf(person) === name)
  // 붙일 본부 없는 부서가 하나도 없으면 따로 보여 준다
  const looseExecutives = noHqDepartments.length ? [] : noHqExecutives

  // 찾은 사람(임원·대표이사·부사장 빼고)의 부서는 펼친다
  const foundDepartments = matches
    .filter((person) => person.role !== "executive" && !topPositions.includes(person.position))
    .map((person) => person.department)
  const isOpen = (name: string) => expanded.includes(name) || foundDepartments.includes(name)
  const toggle = (name: string) =>
    setExpanded(isOpen(name) ? expanded.filter((item) => item !== name) : [...expanded, name])
  const allOpen = departments.every((department) => isOpen(department.name))

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

  // 담당 임원: 이름·직급 한 줄 (누르면 사람 편집)
  const executiveChips = (members: OrgPerson[]) => (
    <div className="people-org-chart-exec">
      <span>담당 임원</span>
      {members.map((person) => (
        <button
          key={person.employeeNo}
          type="button"
          className={[
            "people-org-chart-exec-chip",
            person.status === "retired" ? "retired" : "",
            matches.some((match) => match.employeeNo === person.employeeNo) ? "found" : "",
          ].join(" ")}
          ref={(element) => {
            if (element) cardRefs.current.set(person.employeeNo, element)
            else cardRefs.current.delete(person.employeeNo)
          }}
          onClick={() => open(person)}
        >
          <strong>{person.name}</strong>
          {person.position}
        </button>
      ))}
    </div>
  )

  // 부서 카드: 이름·인원. 누르면 직급별 사람 카드를 펼친다. 본부 없는 부서는 담당 임원도
  const departmentCard = (department: (typeof departments)[number]) => {
    const open = isOpen(department.name)
    const owners = executivesOfDepartment(department.name)
    return (
      <div key={department.name} className={`people-org-chart-dept ${open ? "open" : ""}`}>
        <button
          type="button"
          className="people-org-chart-dept-head"
          aria-expanded={open}
          onClick={() => toggle(department.name)}
        >
          <strong>{department.name}</strong>
          <span>{`${department.count}명`}</span>
          {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {owners.length > 0 && executiveChips(owners)}
        {open && (
          <div className="people-org-chart-dept-body">
            {department.layers.length ? (
              department.layers.map((layer) => (
                <div key={layer.position} className="people-org-chart-layer">
                  <div className="people-org-chart-layer-name">{layer.position}</div>
                  <div className="people-org-chart-row">{layer.people.map(card)}</div>
                </div>
              ))
            ) : (
              <p className="people-org-chart-dept-empty">사람이 없습니다.</p>
            )}
          </div>
        )}
      </div>
    )
  }

  // 직함 카드 (대표이사·부사장·본부). 대표이사·부사장은 이름, 본부는 담당 임원
  const titleCard = (title: string, members: OrgPerson[], kind: "top" | "hq", empty?: string) => (
    <div className={`people-org-chart-title ${kind}`}>
      <strong>{title}</strong>
      {kind === "top" && members.length > 0 && <div className="people-org-chart-row">{members.map(card)}</div>}
      {kind === "hq" && members.length > 0 && executiveChips(members)}
      {members.length === 0 && empty && <span>{empty}</span>}
    </div>
  )

  // 부사장 줄의 한쪽: 카드 사이·부사장 쪽 끝에만 가로선
  const sideItems = (list: (typeof departments)[number][], side: "left" | "right") => {
    const items = list.map(departmentCard)
    const line = (key: string) => <div key={key} className="people-org-chart-hline" />
    const joined = items.flatMap((item, index) => (index ? [line(`l${index}`), item] : [item]))
    if (!joined.length) return joined
    return side === "left" ? [...joined, line("vp")] : [line("vp"), ...joined]
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
          <p>대표이사 → 부사장 → 본부 → 부서 순으로 봅니다. 부서를 누르면 사람이 펼쳐지고, 사람을 눌러 부서·직급·역할을 바꾸거나 퇴사 처리합니다.</p>
        </div>
      </div>

      {!ready && (
        <div className="people-org-chart-notice" role="status">
          <span>{org.source === "error" ? `불러오지 못했습니다. (${org.error})` : "불러오는 중입니다…"}</span>
        </div>
      )}

      {ready && locked && (
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
        <button
          type="button"
          className="people-org-chart-secondary"
          onClick={() => setExpanded(allOpen ? [] : departments.map((department) => department.name))}
        >
          {allOpen ? "전체 접기" : "전체 펼치기"}
        </button>
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
      <div className="people-org-chart-scroll" ref={scrollRef} hidden={!ready}>
        <div className="people-org-chart-tree">
          {/* 대표이사 */}
          {titleCard("대표이사", ceo, "top")}
          <div className="people-org-chart-vline" />

          {/* 부사장 + 양옆 본부 없는 부서 (가로선으로 연결) */}
          <div className="people-org-chart-vp-row">
            <div className="people-org-chart-side left">{sideItems(leftDepartments, "left")}</div>
            <div className="people-org-chart-vp">
              {titleCard("부사장", vp, "top")}
              {looseExecutives.length > 0 && titleCard("본부 없는 임원", looseExecutives, "hq")}
            </div>
            <div className="people-org-chart-side right">{sideItems(rightDepartments, "right")}</div>
          </div>

          {/* 부사장 아래 본부 → 소속 부서 */}
          {headquarterNames.length > 0 && (
            <div className="people-org-chart-branch">
              {headquarterNames.map((headquarters) => (
                <div key={headquarters} className="people-org-chart-node">
                  {titleCard(headquarters, executivesOf(headquarters), "hq", "담당 임원 없음")}
                  {departmentsOf(headquarters).length > 0 && (
                    <div className="people-org-chart-branch">
                      {departmentsOf(headquarters).map((department) => (
                        <div key={department.name} className="people-org-chart-node">
                          {departmentCard(department)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
                disabled={locked || saving}
                onClick={() => void apply(draft, `${selected.name}님 정보를 저장했습니다.`)}
              >
                {saving ? "저장하는 중…" : "저장"}
              </button>
            </div>

            <button
              type="button"
              className={selected.status === "active" ? "people-org-chart-danger" : "people-org-chart-secondary"}
              disabled={saving}
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
                disabled={saving}
                onClick={() => {
                  void apply(
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
