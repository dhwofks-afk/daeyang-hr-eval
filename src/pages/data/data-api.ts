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

// 전체 내려받기 엑셀의 시트 (모든 평가, docs/11). 평가 번호 칸(cycle_id)으로 평가를 구분한다.
// 서술형 답·종합 의견은 따로 시트로 뺀다. 전체 삭제가 지우는 자료(자기관찰·만족도·건의)도 함께 받는다
type Row = Record<string, unknown>
const filled = (key: string) => (row: Row) => typeof row[key] === "string" && (row[key] as string).trim() !== ""

export const backupSheets: { sheet: string; table: string; select: string; order: string; keep?: (row: Row) => boolean }[] = [
  { sheet: "평가", table: "cycles", select: "id, name, status, start_date, deadline, result_published, published_at", order: "id" },
  { sheet: "직원", table: "employees", select: "id, employee_no, name, department_id, headquarters_id, position, role, excluded, status", order: "id" },
  { sheet: "평가 건", table: "cases", select: "id, cycle_id, target_id, evaluator_id, stage, status, submitted_at", order: "id" },
  { sheet: "답", table: "answers", select: "case_id, question_id, score, updated_at", order: "case_id" },
  { sheet: "서술형", table: "answers", select: "case_id, question_id, essay, updated_at", order: "case_id", keep: filled("essay") },
  { sheet: "종합 의견", table: "cases", select: "id, cycle_id, target_id, evaluator_id, stage, opinion, submitted_at", order: "id", keep: filled("opinion") },
  { sheet: "확정 결과", table: "final_results", select: "*", order: "cycle_id" },
  { sheet: "보정", table: "adjustments", select: "*", order: "id" },
  { sheet: "반려", table: "return_logs", select: "*", order: "id" },
  { sheet: "자기관찰", table: "self_observations", select: "*", order: "cycle_id" },
  { sheet: "건의", table: "suggestions", select: "cycle_id, content", order: "cycle_id" },
  { sheet: "만족도", table: "satisfaction", select: "cycle_id, score, comment", order: "cycle_id" },
]

export async function readBackup(sheet: (typeof backupSheets)[number]) {
  const rows = await readAll(sheet.table, sheet.select, sheet.order)
  return sheet.keep ? rows.filter(sheet.keep) : rows
}
