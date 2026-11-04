import { useCallback, useEffect, useState } from "react"
import { Database, Download, Lock, Upload } from "lucide-react"
import { useNavigate } from "react-router"
import { downloadText, parseCsv, toCsv } from "./csv"
import {
  backupTables,
  importEmployees,
  isAdminSession,
  loadCycles,
  loadDepartmentHeadquarters,
  loadDepartments,
  loadHeadquarters,
  loadEmployees,
  loadNoEvaluationPositions,
  loadPositions,
  deleteEvaluationRecords,
  readBackup,
  type Cycle,
  type Employee,
  type ImportResult,
  type ImportRow,
} from "./data-api"
import "./data.css"

// 명단 양식의 칸 (순서 고정)
// 본부: 임원만 적는다 (비우면 본부 없는 임원). 팀원·팀장은 비우거나 부서의 본부와 같게 (014)
const HEADER = ["이름", "사번", "부서", "본부", "직급", "역할", "평가 제외"]
// 직군 칸이 있던 예전 양식도 받는다 (직군 칸은 읽지 않고 버린다)
const OLD_HEADER = ["이름", "사번", "부서", "본부", "직급", "역할", "직군", "평가 제외"]
const OLD_GROUP_COLUMN = 6
const roleCodes: Record<string, ImportRow["role"]> = { 팀원: "member", 팀장: "leader", 임원: "executive" }
const roleNames = { member: "팀원", leader: "팀장", executive: "임원" }

type Kind = "new" | "changed" | "same" | "error"
type PreviewRow = { line: number; kind: Kind; row: ImportRow | null; reasons: string[]; raw: string[] }
type Message = { ok: boolean; text: string } | null
type Confirm = { title: string; text: string; action: () => Promise<void> } | null

const kindNames: Record<Kind, string> = { new: "새 직원", changed: "바뀜", same: "그대로", error: "오류" }

function Data() {
  const navigate = useNavigate()
  const [ready, setReady] = useState<"checking" | "no-login" | "ok">("checking")
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [headquarters, setHeadquarters] = useState<string[]>([])
  const [departmentHq, setDepartmentHq] = useState<Record<string, string | null>>({})
  const [positions, setPositions] = useState<string[]>([])
  const [noEvaluation, setNoEvaluation] = useState<string[]>([])
  const [fileName, setFileName] = useState("")
  const [preview, setPreview] = useState<PreviewRow[] | null>(null)
  const [retire, setRetire] = useState<string[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [busy, setBusy] = useState(false)
  // 전체 삭제: 이 화면에서 전체 내려받기를 한 뒤에만 열린다
  const [backedUp, setBackedUp] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState("")
  const [message, setMessage] = useState<Message>(null)

  const reload = useCallback(async () => {
    const [cycleList, employeeList, departmentList, hqList, departmentHqMap, positionList, noEvaluationList] = await Promise.all([
      loadCycles(),
      loadEmployees(),
      loadDepartments(),
      loadHeadquarters(),
      loadDepartmentHeadquarters(),
      loadPositions(),
      loadNoEvaluationPositions(),
    ])
    setCycles(cycleList)
    setEmployees(employeeList)
    setDepartments(departmentList)
    setHeadquarters(hqList)
    setDepartmentHq(departmentHqMap)
    setPositions(positionList)
    setNoEvaluation(noEvaluationList)
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      if (!(await isAdminSession())) {
        if (active) setReady("no-login")
        return
      }
      try {
        await reload()
      } catch (error) {
        if (active) setMessage({ ok: false, text: `불러오지 못했습니다: ${(error as Error).message}` })
      }
      if (active) setReady("ok")
    })()
    return () => {
      active = false
    }
  }, [reload])

  if (ready === "checking") return <p className="data-notice">불러오는 중입니다…</p>
  if (ready === "no-login") {
    return (
      <div className="data-page">
        <Heading />
        <p className="data-notice">
          이 화면은 실제 관리자 로그인이 필요합니다. 로그아웃한 뒤 "관리자 로그인"으로 들어와 주세요.
        </p>
      </div>
    )
  }

  const inProgress = cycles.find((cycle) => cycle.status === "in_progress") ?? null

  const run = async (work: () => Promise<string>) => {
    setBusy(true)
    setMessage(null)
    try {
      setMessage({ ok: true, text: await work() })
    } catch (error) {
      setMessage({ ok: false, text: (error as Error).message })
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  // ---------- ① 명단 올리기 ----------

  const downloadTemplate = () =>
    downloadText("직원명단_양식.csv", toCsv(HEADER, [["홍길동", "900099", departments[0] ?? "", "", "사원", "팀원", "아니오"]]))

  const readFile = async (file: File) => {
    setResult(null)
    setMessage(null)
    setFileName(file.name)
    const parsed = parseCsv(await file.text())
    const head = parsed.length ? parsed[0].map((cell) => cell.trim()).join(",") : ""
    const rows = head === OLD_HEADER.join(",")
      ? parsed.map((cells) => cells.filter((_, index) => index !== OLD_GROUP_COLUMN))
      : parsed
    if (!rows.length || (head !== HEADER.join(",") && head !== OLD_HEADER.join(","))) {
      setPreview(null)
      setMessage({ ok: false, text: `첫 줄이 양식과 다릅니다. 양식의 칸(${HEADER.join(", ")})을 그대로 써 주세요.` })
      return
    }
    const byNo = new Map(employees.map((employee) => [employee.employee_no, employee]))
    const counts = new Map<string, number>()
    for (const cells of rows.slice(1)) {
      const no = (cells[1] ?? "").trim()
      counts.set(no, (counts.get(no) ?? 0) + 1)
    }

    const checked: PreviewRow[] = rows.slice(1).map((cells, index) => {
      const [name, no, department, hq, position, role, excludedText] = cells.map((cell) => (cell ?? "").trim())
      const reasons: string[] = []
      if (!name) reasons.push("이름이 비어 있음")
      if (!/^[0-9]+$/.test(no ?? "")) reasons.push("사번은 숫자만")
      else if ((counts.get(no) ?? 0) > 1) reasons.push("사번 중복")
      // 부서·본부 이름은 정확히 일치해야 한다 (생산팀/생산부처럼 섞인 이름은 오류)
      if (!departments.includes(department ?? "")) reasons.push(`없는 부서(${department || "빈칸"}) · 이름이 정확히 같아야 함`)
      if (hq && !headquarters.includes(hq)) reasons.push(`없는 본부(${hq}) · 이름이 정확히 같아야 함`)
      else if (hq && role !== "임원" && departments.includes(department ?? "") && departmentHq[department] !== hq)
        reasons.push(`부서(${department})와 본부(${hq})가 맞지 않음`)
      if (!positions.includes(position ?? "")) reasons.push(`잘못된 직급(${position || "빈칸"})`)
      if (!roleCodes[role ?? ""]) reasons.push("역할은 팀원·팀장·임원")
      const excluded = ["예", "Y", "y", "O", "o"].includes(excludedText ?? "")
        ? true
        : ["", "아니오", "N", "n", "X", "x"].includes(excludedText ?? "")
          ? false
          : null
      if (excluded === null) reasons.push("평가 제외는 예·아니오")
      const line = index + 2
      if (reasons.length) return { line, kind: "error", row: null, reasons, raw: cells }

      const row: ImportRow = {
        employee_no: no,
        name,
        department,
        // 본부 칸은 임원만 저장한다 (팀원·팀장의 본부는 부서에서 정해짐)
        headquarters: roleCodes[role] === "executive" && hq ? hq : null,
        position,
        role: roleCodes[role],
        // 평가 불참 직급(대표이사·부사장)은 파일 값과 상관없이 평가 제외 (서버와 같게)
        excluded: (excluded as boolean) || noEvaluation.includes(position),
      }
      const old = byNo.get(no)
      const kind: Kind = !old
        ? "new"
        : old.name !== row.name ||
            old.department !== row.department ||
            old.headquarters !== row.headquarters ||
            old.position !== row.position ||
            old.role !== row.role ||
            old.excluded !== row.excluded ||
            old.status !== "active"
          ? "changed"
          : "same"
      return { line, kind, row, reasons: [], raw: cells }
    })
    setPreview(checked)
    setRetire([])
  }

  const fileNos = new Set((preview ?? []).map((item) => (item.raw[1] ?? "").trim()))
  const retireCandidates = preview
    ? employees.filter((employee) => employee.status === "active" && !fileNos.has(employee.employee_no))
    : []
  const errors = (preview ?? []).filter((item) => item.kind === "error")
  // 엑셀이 사번 앞자리 0을 지웠을 수 있는 줄 (막지는 않고 알려만 준다)
  const shortNos = (preview ?? []).filter((item) => item.row && item.row.employee_no.length < 6)
  const count = (kind: Kind) => (preview ?? []).filter((item) => item.kind === kind).length
  const canApply = !!preview && !errors.length && !inProgress && !busy

  const apply = () =>
    setConfirm({
      title: "명단을 적용할까요?",
      text: `새 직원 ${count("new")}명 · 바뀜 ${count("changed")}명 · 퇴사 ${retire.length}명을 반영하고, 새 직원의 로그인 계정을 만듭니다. 만든 계정은 되돌릴 수 없습니다.`,
      action: () =>
        run(async () => {
          const rows = (preview ?? []).flatMap((item) => (item.row ? [item.row] : []))
          const done = await importEmployees(rows, retire)
          setResult(done)
          setPreview(null)
          setFileName("")
          await reload()
          return "명단을 적용했습니다."
        }),
    })

  // ---------- ② 전체 내려받기 ----------

  const backup = () =>
    run(async () => {
      for (const table of backupTables) {
        const rows = await readBackup(table)
        const header = rows.length ? Object.keys(rows[0]) : []
        downloadText(
          `전체_${table.file}.csv`,
          toCsv(header, rows.map((row) => header.map((key) => row[key]))),
        )
        await new Promise((resolve) => setTimeout(resolve, 400))
      }
      setBackedUp(true)
      return `모든 평가의 자료 ${backupTables.length}개를 내려받았습니다.`
    })

  return (
    <div className="data-page">
      <Heading />

      {message && (
        <p className={`data-message ${message.ok ? "ok" : "error"}`} role="status">
          {message.text}
        </p>
      )}

      {/* ① 직원 명단 올리기 */}
      <section className="data-card">
        <div className="data-card-title">직원 명단 올리기</div>
        {inProgress ? (
          <div className="data-locked">
            <Lock size={20} />
            {`${inProgress.id}회차가 평가 중이라 명단을 올릴 수 없습니다.`}
          </div>
        ) : (
          <>
            <p className="data-guide">
              양식을 내려받아 엑셀에서 채운 뒤 "CSV UTF-8(쉼표로 분리)"로 저장해서 올려 주세요. 올리기만 해서는 저장되지 않습니다.
              사번이 0으로 시작하면(예: 0610011) 엑셀에서 사번 칸을 먼저 "텍스트" 서식으로 바꿔 주세요. 그러지 않으면 앞자리 0이 사라집니다.
            </p>
            <div className="data-inline">
              <button type="button" className="data-secondary" onClick={downloadTemplate}>
                <Download size={19} />
                양식 내려받기
              </button>
              <label className="data-file">
                <Upload size={19} />
                {fileName || "파일 올리기"}
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void readFile(file)
                    event.target.value = ""
                  }}
                />
              </label>
            </div>
          </>
        )}

        {preview && (
          <>
            <div className="data-counts">
              {(["new", "changed", "same", "error"] as Kind[]).map((kind) => (
                <span key={kind} className={`data-count ${kind}`}>{`${kindNames[kind]} ${count(kind)}`}</span>
              ))}
              <span className="data-count retire">{`퇴사 후보 ${retireCandidates.length}`}</span>
            </div>

            {shortNos.length > 0 && (
              <div className="data-locked">
                {`사번이 6자리보다 짧은 줄이 ${shortNos.length}개 있습니다 (${shortNos
                  .slice(0, 5)
                  .map((item) => `${item.line}번째 줄 ${item.row?.employee_no}`)
                  .join(", ")}${shortNos.length > 5 ? " …" : ""}). 엑셀이 앞자리 0을 지웠는지 확인해 주세요.`}
              </div>
            )}

            {errors.length > 0 && (
              <div className="data-errors">
                <strong>오류가 있어 적용할 수 없습니다. 파일을 고쳐 다시 올려 주세요.</strong>
                <ul>
                  {errors.map((item) => (
                    <li key={item.line}>{`${item.line}번째 줄: ${item.reasons.join(", ")}`}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>줄</th>
                    <th>구분</th>
                    {HEADER.map((name) => (
                      <th key={name}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview
                    .filter((item) => item.kind !== "same")
                    .map((item) => (
                      <tr key={item.line} className={`data-row-${item.kind}`}>
                        <td>{item.line}</td>
                        <td>
                          <span className={`data-count ${item.kind}`}>{kindNames[item.kind]}</span>
                        </td>
                        {HEADER.map((_, index) => (
                          <td key={index}>{item.raw[index] ?? ""}</td>
                        ))}
                      </tr>
                    ))}
                  {!preview.some((item) => item.kind !== "same") && (
                    <tr>
                      <td colSpan={HEADER.length + 2} className="data-empty">
                        바뀌는 사람이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {retireCandidates.length > 0 && (
              <div className="data-retire">
                <strong>퇴사 후보: 지금 재직인데 파일에 없는 사람 (체크한 사람만 퇴사 처리)</strong>
                {retireCandidates.map((employee) => (
                  <label key={employee.id}>
                    <input
                      type="checkbox"
                      checked={retire.includes(employee.employee_no)}
                      onChange={(event) =>
                        setRetire(
                          event.target.checked
                            ? [...retire, employee.employee_no]
                            : retire.filter((no) => no !== employee.employee_no),
                        )
                      }
                    />
                    {`${employee.name} (${employee.employee_no} · ${employee.department}${employee.headquarters ? ` · ${employee.headquarters}` : ""} · ${employee.position} · ${roleNames[employee.role]})`}
                  </label>
                ))}
              </div>
            )}

            <button type="button" className="data-primary" disabled={!canApply} onClick={apply}>
              적용
            </button>
          </>
        )}

        {result && (
          <div className="data-result">
            <strong>{`적용 결과: 새 직원 ${result.new} · 바뀜 ${result.changed} · 퇴사 ${result.retired} · 계정 생성 ${result.accounts_created} · 계정 생성 실패 ${result.accounts_failed}`}</strong>
            {result.accounts_failed > 0 && (
              <p>{`계정을 만들지 못한 사번: ${result.failed_employee_nos.join(", ")} — 같은 파일을 다시 올려 적용하면 계정만 다시 만듭니다.`}</p>
            )}
            <p>새 직원이나 부서·역할이 바뀐 사람의 평가 건은 자동으로 바뀌지 않습니다. 평가 관계에서 [규칙대로 다시 만들기]를 눌러 주세요.</p>
            <button type="button" className="data-secondary" onClick={() => navigate("/admin/people/relations")}>
              평가 관계로
            </button>
          </div>
        )}
      </section>

      {/* ② 전체 내려받기 */}
      <section className="data-card">
        <div className="data-card-title">전체 내려받기 (백업)</div>
        <p className="data-guide">
          {`모든 평가의 자료를 CSV ${backupTables.length}개(${backupTables.map((table) => table.file).join(", ")})로 차례로 내려받습니다. 서술형 답·종합 의견도 들어 있습니다. 브라우저가 "여러 파일 다운로드"를 물으면 허용해 주세요.`}
        </p>
        <div className="data-inline">
          <button type="button" className="data-secondary" disabled={busy} onClick={backup}>
            <Download size={19} />
            전체 내려받기
          </button>
        </div>
      </section>

      {/* ④ 전체 삭제: 평가 기록만. 이 화면에서 전체 내려받기를 한 뒤에만 열린다 */}
      <section className="data-card">
        <div className="data-card-title">전체 삭제 (평가 기록)</div>
        <p className="data-guide">
          모든 평가의 평가 건·답·종합 의견·확정 결과·보정·반려·자기관찰·만족도·건의를 지우고, 평가 카드는 모두 "준비 중"으로 돌립니다. 직원 명단·계정·문항·반영 비율·부서·본부·부서 KPI·직급 목록은 남습니다. 되돌릴 수 없습니다.
        </p>
        {!backedUp && (
          <div className="data-locked">
            <Lock size={20} />
            먼저 위의 [전체 내려받기]로 자료를 내려받아 보관해 주세요. 그 뒤에 버튼이 열립니다.
          </div>
        )}
        <button
          type="button"
          className="data-danger"
          disabled={!backedUp || busy}
          onClick={() => {
            setDeleteText("")
            setDeleteOpen(true)
          }}
        >
          전체 삭제
        </button>
      </section>

      {deleteOpen && (
        <div className="data-overlay" role="dialog" aria-modal="true" aria-labelledby="data-delete-title">
          <div className="data-confirm">
            <div id="data-delete-title" className="data-confirm-title">
              평가 기록을 모두 지울까요?
            </div>
            <p>되돌릴 수 없습니다. 계속하려면 아래 칸에 "삭제"라고 입력해 주세요.</p>
            <input
              className="data-delete-input"
              type="text"
              aria-label="확인 글자"
              placeholder="삭제"
              value={deleteText}
              onChange={(event) => setDeleteText(event.target.value)}
            />
            <div className="data-confirm-buttons">
              <button type="button" className="data-secondary" disabled={busy} onClick={() => setDeleteOpen(false)}>
                취소
              </button>
              <button
                type="button"
                className="data-danger"
                disabled={busy || deleteText.trim() !== "삭제"}
                onClick={() =>
                  void run(async () => {
                    const count = await deleteEvaluationRecords(deleteText.trim())
                    setDeleteOpen(false)
                    setBackedUp(false)
                    await reload()
                    return `평가 기록 ${count}건을 지웠습니다.`
                  })
                }
              >
                {busy ? "처리 중" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="data-overlay" role="dialog" aria-modal="true" aria-labelledby="data-confirm-title">
          <div className="data-confirm">
            <div id="data-confirm-title" className="data-confirm-title">
              {confirm.title}
            </div>
            <p>{confirm.text}</p>
            <div className="data-confirm-buttons">
              <button type="button" className="data-secondary" disabled={busy} onClick={() => setConfirm(null)}>
                취소
              </button>
              <button type="button" className="data-primary" disabled={busy} onClick={() => void confirm.action()}>
                {busy ? "처리 중" : "확인"}
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
        <Database size={30} strokeWidth={1.8} />
      </div>
      <div>
        <div className="detail-area">관리자 영역</div>
        <div className="detail-title" role="heading" aria-level={1}>
          데이터 관리
        </div>
        <p>직원 명단을 올리고, 평가 자료를 내려받습니다. 새 평가는 평가 목록에서 추가합니다.</p>
      </div>
    </div>
  )
}

export default Data
