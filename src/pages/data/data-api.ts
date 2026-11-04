// 데이터 관리 화면의 서버 읽기·호출 (docs/11-데이터관리.md)
// 관리자로 실제 로그인했을 때만 읽힌다. 이 화면은 관리자 전용이라 사번을 읽는다.
import { supabase } from "@/lib/supabase"

export type Cycle = { id: number; name: string; status: "before" | "in_progress" | "done" }

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

export async function finishCycle(cycleId: number) {
  const { error } = await client().rpc("finish_cycle", { p_cycle_id: cycleId })
  if (error) throw new Error(error.message)
}

// 전체 삭제: 평가 기록만 지운다 (평가 건·답·확정 결과·보정·반려·건의·만족도). 확인 글자 "삭제"를 서버가 다시 확인한다 (011)
export async function deleteEvaluationRecords(confirmText: string) {
  const { data, error } = await client().rpc("delete_evaluation_records", { p_confirm: confirmText })
  if (error) throw new Error(error.message)
  return data as number
}

export async function newCycle(name: string) {
  const { data, error } = await client().rpc("new_cycle", { p_name: name })
  if (error) throw new Error(error.message)
  return data as number
}

// 전체 읽기 (한 번에 1000줄까지라 나눠 읽는다)
async function readAll(
  table: string,
  select: string,
  order: string,
  cycleColumn: string | null,
  cycleId: number,
) {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    let query = client().from(table).select(select).order(order)
    if (cycleColumn) query = query.eq(cycleColumn, cycleId)
    const { data, error } = await query.range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...(data as unknown as Record<string, unknown>[]))
    if (!data || data.length < 1000) return rows
  }
}

// 백업할 표 (회차 기준). 답은 평가 건을 거쳐 회차로 거른다
export const backupTables: {
  file: string
  table: string
  select: string
  order: string
  cycleColumn: string | null
}[] = [
  { file: "직원", table: "employees", select: "id, employee_no, name, department_id, headquarters_id, position, role, excluded, status", order: "id", cycleColumn: null },
  { file: "평가건", table: "cases", select: "id, cycle_id, target_id, evaluator_id, stage, status, opinion, submitted_at", order: "id", cycleColumn: "cycle_id" },
  { file: "답", table: "answers", select: "case_id, question_id, score, essay, updated_at, cases!inner(cycle_id)", order: "case_id", cycleColumn: "cases.cycle_id" },
  { file: "확정결과", table: "final_results", select: "*", order: "employee_id", cycleColumn: "cycle_id" },
  { file: "보정기록", table: "adjustments", select: "*", order: "id", cycleColumn: "cycle_id" },
  { file: "반려기록", table: "return_logs", select: "*", order: "id", cycleColumn: "cycle_id" },
]

export async function readBackup(table: (typeof backupTables)[number], cycleId: number) {
  const rows = await readAll(table.table, table.select, table.order, table.cycleColumn, cycleId)
  // 거르기용으로 붙인 칸(cases)은 뺀다
  return rows.map(({ cases: _cases, ...rest }) => rest)
}
