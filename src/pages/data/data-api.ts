// 데이터 관리 화면의 서버 읽기·호출 (docs/11-데이터관리.md)
// 관리자로 실제 로그인했을 때만 읽힌다. 이 화면은 관리자 전용이라 사번을 읽는다.
import { supabase } from "@/lib/supabase"

export type Cycle = { id: number; name: string; status: "before" | "in_progress" | "done" | "cleared" }

export type Employee = {
  id: number
  employee_no: string
  name: string
  department: string
  position: string
  role: "member" | "leader" | "executive"
  excluded: boolean
  status: "active" | "retired"
  headquarters: string | null // 본부 (임원만, 014). 비어 있으면 본부 없는 임원
}

export type ImportLog = { id: number; cycle_id: number | null; imported_at: string }

// Edge Function에 보내는 한 줄 (서버 값 이름)
export type ImportRow = Omit<Employee, "id" | "status">

export type ImportResult = {
  new: number
  changed: number
  retired: number
  accounts_created: number
  accounts_failed: number
  failed_employee_nos: string[]
}

const client = () => {
  if (!supabase) throw new Error("저장소 설정(.env.local)이 없어 불러올 수 없습니다.")
  return supabase
}

// 실제 관리자로 로그인했는지 (역할 미리보기면 false)
export async function isAdminSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  if (!data.session) return false
  const { data: isAdmin } = await supabase.rpc("is_admin")
  return isAdmin === true
}

export async function loadCycles(): Promise<Cycle[]> {
  const { data, error } = await client().from("cycles").select("id, name, status").order("id")
  if (error) throw new Error(error.message)
  return data as Cycle[]
}

export async function loadDepartments(): Promise<string[]> {
  const { data, error } = await client().from("departments").select("name").order("id")
  if (error) throw new Error(error.message)
  return (data as { name: string }[]).map((row) => row.name)
}

// 본부 이름 (014)
export async function loadHeadquarters(): Promise<string[]> {
  const { data, error } = await client().from("headquarters").select("name").order("sort_order")
  if (error) throw new Error(error.message)
  return (data as { name: string }[]).map((row) => row.name)
}

// 부서 → 본부 (본부 없는 부서는 null)
export async function loadDepartmentHeadquarters(): Promise<Record<string, string | null>> {
  const { data, error } = await client().from("departments").select("name, headquarters(name)")
  if (error) throw new Error(error.message)
  return Object.fromEntries(
    (data as unknown as { name: string; headquarters: { name: string } | null }[]).map((row) => [
      row.name,
      row.headquarters?.name ?? null,
    ]),
  )
}

export async function loadPositions(): Promise<string[]> {
  const { data, error } = await client().from("positions").select("name").order("sort_order")
  if (error) throw new Error(error.message)
  return (data as { name: string }[]).map((row) => row.name)
}

// 평가 불참 직급 (013: 대표이사·부사장). 서버가 저장할 때 자동으로 평가 제외로 바꾸므로 미리보기도 같게 보여 준다.
// 013 실행 전이라 칸이 없으면 빈 목록
export async function loadNoEvaluationPositions(): Promise<string[]> {
  const { data, error } = await client().from("positions").select("name").eq("no_evaluation", true)
  if (error) return []
  return (data as { name: string }[]).map((row) => row.name)
}

export async function loadEmployees(): Promise<Employee[]> {
  const { data, error } = await client()
    .from("employees")
    .select("id, employee_no, name, position, role, excluded, status, departments(name), headquarters(name)")
    .order("id")
  if (error) throw new Error(error.message)
  return (
    data as unknown as (Omit<Employee, "department" | "headquarters"> & {
      departments: { name: string } | null
      headquarters: { name: string } | null
    })[]
  ).map(({ departments, headquarters, ...rest }) => ({
    ...rest,
    department: departments?.name ?? "",
    headquarters: headquarters?.name ?? null,
  }))
}

export async function loadImportLogs(): Promise<ImportLog[]> {
  const { data, error } = await client()
    .from("import_logs")
    .select("id, cycle_id, imported_at")
    .order("id")
  if (error) throw new Error(error.message)
  return data as ImportLog[]
}

// 명단 반영: Edge Function import-employees (계정 만들기까지)
export async function importEmployees(rows: ImportRow[], retire: string[]): Promise<ImportResult> {
  const { data, error } = await client().functions.invoke("import-employees", {
    body: { rows, retire },
  })
  if (error) {
    // 함수가 돌려준 오류 문구가 있으면 그것을 보여 준다
    const context = (error as { context?: Response }).context
    const detail = context ? await context.json().catch(() => null) : null
    throw new Error(detail?.error ?? error.message)
  }
  return data as ImportResult
}

// 전체 삭제: 모든 평가의 평가 건·답·종합 의견·확정 결과·보정·반려·자기관찰·만족도·건의를 지우고 평가 카드는 모두 "준비 중"으로 (017, docs/11).
// 확인 글자 "삭제"를 서버가 다시 확인한다. 지운 줄 수를 돌려준다
export async function deleteEvaluationRecords(confirmText: string) {
  const { data, error } = await client().rpc("delete_evaluation_records", { p_confirm: confirmText })
  if (error) throw new Error(error.message)
  return data as number
}

// 전체 읽기 (한 번에 1000줄까지라 나눠 읽는다)
async function readAll(table: string, select: string, order: string) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client().from(table).select(select).order(order).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (!data || data.length < 1000) return rows
  }
}

// ---------- 전체 내려받기 엑셀 (보관·열람용, docs/11) ----------
// 사람이 읽기 좋게: 칸 이름·값은 한글, 내부 번호 대신 평가 이름·사람 이름·부서, 내부 칸·만든 시각은 뺀다.
// 칸 순서: 평가 → 대상(이름·부서·직급) → 평가자 → 단계 → 점수·내용. 건의·만족도는 작성자가 없다 (표에도 없음).
// 첫 줄 고정, 칸 너비는 내용에 맞춘다. 엑셀 도구(xlsx)는 버튼을 누를 때만 불러와 넘겨받는다

type XlsxModule = typeof import("xlsx")
type Cell = string | number | null
type Sheet = { name: string; header: string[]; rows: Cell[][] }
type Row = Record<string, unknown>

export const backupSheetNames = [
  "평가", "직원", "평가 건", "답", "서술형", "종합 의견", "확정 결과", "보정", "반려", "자기관찰", "건의", "만족도",
]

const cycleStatusText: Record<string, string> = { before: "준비 중", in_progress: "평가 중", done: "완료", cleared: "결과 삭제됨" }
const stageText: Record<string, string> = {
  self: "자기평가",
  leader: "팀장평가",
  executive: "임원평가",
  upward: "상향평가",
  exec_upward: "임원상향평가",
}
const caseStatusText: Record<string, string> = { not_started: "작성 전", in_progress: "작성 중", submitted: "제출", returned: "반려" }
const roleText: Record<string, string> = { member: "팀원", leader: "팀장", executive: "임원" }
// 문항 점수 A~E (5~1)
const gradeText: Record<number, string> = { 5: "A", 4: "B", 3: "C", 2: "D", 1: "E" }

const text = (value: unknown) => (value === null || value === undefined ? "" : String(value))
const numberOrBlank = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value))
const yesNo = (value: unknown) => (value ? "예" : "아니오")

// 저장소 시각(UTC) → 이 컴퓨터 시각 (예: 2026-11-04 14:00)
function timeText(value: unknown) {
  if (!value) return ""
  const time = new Date(String(value))
  const two = (n: number) => String(n).padStart(2, "0")
  return `${time.getFullYear()}-${two(time.getMonth() + 1)}-${two(time.getDate())} ${two(time.getHours())}:${two(time.getMinutes())}`
}

// 칸 너비: 한글은 두 칸으로 센다. 너무 넓으면 60에서 자른다
const widthOf = (value: Cell) => [...text(value)].reduce((total, char) => total + (char.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)

// 첫 줄 고정: 무료판 xlsx는 틀 고정을 쓰지 못해서, 만든 파일 안의 시트 설정(sheetView)에 고정 칸을 넣는다
function freezeHeader(XLSX: XlsxModule, bytes: ArrayBuffer) {
  const zip = XLSX.CFB.read(new Uint8Array(bytes), { type: "array" })
  zip.FullPaths.forEach((path: string, index: number) => {
    if (!/xl\/worksheets\/sheet\d+\.xml$/.test(path)) return
    const entry = zip.FileIndex[index]
    const xml = new TextDecoder().decode(entry.content)
    entry.content = new TextEncoder().encode(
      xml.replace(
        '<sheetView workbookViewId="0"/>',
        '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView>',
      ),
    )
    entry.size = entry.content.length
  })
  return new Uint8Array(XLSX.CFB.write(zip, { fileType: "zip", type: "array", compression: true }))
}

// 모든 평가의 자료를 읽어 엑셀 파일(바이트)로 만든다
export async function buildBackupFile(XLSX: XlsxModule): Promise<Uint8Array> {
  const [cycles, employees, cases, answers, questions, finals, adjustments, returns, observations, suggestions, satisfaction] =
    await Promise.all([
      readAll("cycles", "id, name, status, start_date, deadline, result_published, published_at", "id"),
      readAll("employees", "id, employee_no, name, position, role, excluded, status, departments(name), headquarters(name)", "id"),
      readAll("cases", "id, cycle_id, target_id, evaluator_id, stage, status, opinion, submitted_at", "id"),
      readAll("answers", "case_id, question_id, score, essay", "case_id"),
      readAll("questions", "id, field, factor, content, type, sort_order", "id"),
      readAll(
        "final_results",
        "cycle_id, employee_id, department_name, score_self, score_leader, score_executive, score_upward, score_exec_upward, weighted, kpi_applied, final, published_at",
        "cycle_id",
      ),
      readAll("adjustments", "id, cycle_id, employee_id, before_score, after_score, reason, adjusted_by, adjusted_at", "id"),
      readAll("return_logs", "id, cycle_id, case_id, reason, returned_by, returned_at", "id"),
      readAll(
        "self_observations",
        "cycle_id, employee_id, workload, difficulty, aptitude, satisfaction, relationships, transfer_wish, wish_department, main_work, other_opinion",
        "cycle_id",
      ),
      readAll("suggestions", "cycle_id, content", "cycle_id"),
      readAll("satisfaction", "cycle_id, score, comment", "cycle_id"),
    ])

  const cycleName = new Map(cycles.map((row) => [row.id, text(row.name)]))
  const person = new Map(
    employees.map((row) => [
      row.id,
      {
        name: text(row.name),
        department: text((row.departments as { name: string } | null)?.name),
        position: text(row.position),
      },
    ]),
  )
  const caseById = new Map(cases.map((row) => [row.id, row]))
  const questionById = new Map(questions.map((row) => [row.id, row]))
  const who = (id: unknown) => person.get(id) ?? { name: "", department: "", position: "" }
  const target = (id: unknown) => {
    const p = who(id)
    return [p.name, p.department, p.position]
  }
  const evaluator = (id: unknown) => {
    const p = who(id)
    return [p.name, p.department]
  }
  // 평가 건 한 줄의 앞 칸: 평가 · 대상(이름·부서·직급) · 평가자(이름·부서) · 단계
  const caseHead = (row: Row | undefined): Cell[] =>
    row
      ? [cycleName.get(row.cycle_id) ?? "", ...target(row.target_id), ...evaluator(row.evaluator_id), stageText[text(row.stage)] ?? text(row.stage)]
      : ["", "", "", "", "", "", ""]
  const caseHeader = ["평가", "대상 이름", "대상 부서", "대상 직급", "평가자 이름", "평가자 부서", "단계"]

  // 답: 평가 건 순서 → 문항 순서
  const answerRows = [...answers].sort(
    (a, b) =>
      Number(a.case_id) - Number(b.case_id) ||
      Number(questionById.get(a.question_id)?.sort_order ?? 0) - Number(questionById.get(b.question_id)?.sort_order ?? 0),
  )
  const questionCells = (row: Row) => {
    const q = questionById.get(row.question_id)
    return [text(q?.field), text(q?.factor), text(q?.content)]
  }

  const sheets: Sheet[] = [
    {
      name: "평가",
      header: ["평가 이름", "상태", "시작일", "마감일", "결과 확정", "확정 시각"],
      rows: cycles.map((row) => [
        text(row.name),
        cycleStatusText[text(row.status)] ?? text(row.status),
        text(row.start_date),
        text(row.deadline),
        yesNo(row.result_published),
        timeText(row.published_at),
      ]),
    },
    {
      name: "직원",
      header: ["이름", "사번", "부서", "본부", "직급", "역할", "평가 제외", "재직 상태"],
      rows: employees.map((row) => [
        text(row.name),
        text(row.employee_no),
        text((row.departments as { name: string } | null)?.name),
        text((row.headquarters as { name: string } | null)?.name),
        text(row.position),
        roleText[text(row.role)] ?? text(row.role),
        yesNo(row.excluded),
        row.status === "retired" ? "퇴사" : "재직",
      ]),
    },
    {
      name: "평가 건",
      header: [...caseHeader, "상태", "제출 시각"],
      rows: cases.map((row) => [...caseHead(row), caseStatusText[text(row.status)] ?? text(row.status), timeText(row.submitted_at)]),
    },
    {
      name: "답",
      header: [...caseHeader, "구분", "평가 내용", "문항", "답(A~E)", "점수"],
      rows: answerRows.map((row) => {
        const isChoice = questionById.get(row.question_id)?.type === "choice"
        const score = numberOrBlank(row.score)
        return [
          ...caseHead(caseById.get(row.case_id)),
          ...questionCells(row),
          isChoice && score !== null ? (gradeText[score] ?? "") : "",
          score,
        ]
      }),
    },
    {
      name: "서술형",
      header: [...caseHeader, "구분", "평가 내용", "문항", "서술 내용"],
      rows: answerRows
        .filter((row) => text(row.essay).trim() !== "")
        .map((row) => [...caseHead(caseById.get(row.case_id)), ...questionCells(row), text(row.essay)]),
    },
    {
      name: "종합 의견",
      header: [...caseHeader, "종합 의견"],
      rows: cases.filter((row) => text(row.opinion).trim() !== "").map((row) => [...caseHead(row), text(row.opinion)]),
    },
    {
      name: "확정 결과",
      header: [
        "평가", "대상 이름", "부서(확정 당시)", "직급", "자기평가", "팀장평가", "임원평가", "상향평가", "임원상향평가",
        "개인 평가(가중 합산)", "KPI 반영 점수", "최종 점수", "확정 시각",
      ],
      rows: finals.map((row) => [
        cycleName.get(row.cycle_id) ?? "",
        who(row.employee_id).name,
        text(row.department_name),
        who(row.employee_id).position,
        numberOrBlank(row.score_self),
        numberOrBlank(row.score_leader),
        numberOrBlank(row.score_executive),
        numberOrBlank(row.score_upward),
        numberOrBlank(row.score_exec_upward),
        numberOrBlank(row.weighted),
        numberOrBlank(row.kpi_applied),
        numberOrBlank(row.final),
        timeText(row.published_at),
      ]),
    },
    {
      name: "보정",
      header: ["평가", "대상 이름", "대상 부서", "대상 직급", "보정 전", "보정 후", "사유", "보정한 사람", "보정 시각"],
      rows: adjustments.map((row) => [
        cycleName.get(row.cycle_id) ?? "",
        ...target(row.employee_id),
        numberOrBlank(row.before_score),
        row.after_score === null ? "보정 취소" : numberOrBlank(row.after_score),
        text(row.reason),
        text(row.adjusted_by),
        timeText(row.adjusted_at),
      ]),
    },
    {
      name: "반려",
      header: [...caseHeader, "반려 사유", "처리한 사람", "반려 시각"],
      rows: returns.map((row) => [...caseHead(caseById.get(row.case_id)), text(row.reason), text(row.returned_by), timeText(row.returned_at)]),
    },
    {
      name: "자기관찰",
      header: [
        "평가", "이름", "부서", "직급", "업무량", "난이도", "적성", "만족도", "대인관계", "이동 희망", "희망 부서", "현재 주요 업무", "기타 의견",
      ],
      rows: observations.map((row) => [
        cycleName.get(row.cycle_id) ?? "",
        ...target(row.employee_id),
        numberOrBlank(row.workload),
        numberOrBlank(row.difficulty),
        numberOrBlank(row.aptitude),
        numberOrBlank(row.satisfaction),
        numberOrBlank(row.relationships),
        numberOrBlank(row.transfer_wish),
        text(row.wish_department),
        text(row.main_work),
        text(row.other_opinion),
      ]),
    },
    {
      name: "건의",
      header: ["평가", "건의 내용"],
      rows: suggestions.map((row) => [cycleName.get(row.cycle_id) ?? "", text(row.content)]),
    },
    {
      name: "만족도",
      header: ["평가", "점수(1~5)", "의견"],
      rows: satisfaction.map((row) => [cycleName.get(row.cycle_id) ?? "", numberOrBlank(row.score), text(row.comment)]),
    },
  ]

  const book = XLSX.utils.book_new()
  for (const sheet of sheets) {
    const table = [sheet.header, ...sheet.rows]
    const ws = XLSX.utils.aoa_to_sheet(table)
    ws["!cols"] = sheet.header.map((_, column) => ({
      wch: Math.min(60, Math.max(...table.map((row) => widthOf(row[column] ?? null))) + 2),
    }))
    XLSX.utils.book_append_sheet(book, ws, sheet.name)
  }
  return freezeHeader(XLSX, XLSX.write(book, { bookType: "xlsx", type: "array", compression: true }))
}
