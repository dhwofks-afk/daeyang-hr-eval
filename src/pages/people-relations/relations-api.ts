// 평가 관계 화면의 서버 읽기·저장 (docs/09-평가관계.md 3·4번)
// 관리자로 실제 로그인했을 때만 읽힌다 (권한 규칙). 사번은 읽지 않는다.
// 저장·다시 만들기는 서버 함수(007)로만 한다.
import { supabase } from "@/lib/supabase"

export type RelationStage = "leader" | "executive" | "upward" | "exec_upward"

export type Cycle = {
  id: number
  name: string
  status: "before" | "in_progress" | "closed" | "done" | "cleared"
  start_date: string | null
  deadline: string | null
}

export type Employee = {
  id: number
  name: string
  department: string
  position: string
  role: "member" | "leader" | "executive"
  status: "active" | "retired"
  excluded: boolean
}

export type CaseRow = {
  id: number
  target_id: number
  evaluator_id: number
  stage: "self" | RelationStage
  hasAnswers: boolean
}

export type RuleRow = { target_id: number; evaluator_id: number; stage: string }

// 대상 한 명의 평가자 (자기평가는 건드리지 않는다)
export type Relation = {
  leader: number | null
  executive: number | null
  upward: number[]
}

// exec_upward: 임원 대상일 때 임원 상향 평가자 목록 (011 save_relations)
export type RelationChange = { target_id: number; exec_upward?: number[] } & Relation

const NOT_CONNECTED = "저장소 설정(.env.local)이 없어 불러올 수 없습니다."

// 실제 관리자로 로그인했는지 (역할 미리보기면 false)
export async function isAdminSession() {
  if (!supabase) return false
  const { data } = await supabase.auth.getSession()
  if (!data.session) return false
  const { data: isAdmin } = await supabase.rpc("is_admin")
  return isAdmin === true
}

export async function loadCycles(): Promise<Cycle[]> {
  if (!supabase) throw new Error(NOT_CONNECTED)
  const { data, error } = await supabase
    .from("cycles")
    .select("id, name, status, start_date, deadline")
    .order("id")
  if (error) throw new Error(error.message)
  return data as Cycle[]
}

export async function loadEmployees(): Promise<Employee[]> {
  if (!supabase) throw new Error(NOT_CONNECTED)
  const { data, error } = await supabase
    .from("employees")
    .select("id, name, position, role, status, excluded, departments(name)")
    .order("id")
  if (error) throw new Error(error.message)
  return (data as unknown as (Omit<Employee, "department"> & { departments: { name: string } | null })[]).map(
    ({ departments, ...rest }) => ({ ...rest, department: departments?.name ?? "" }),
  )
}

export async function loadCases(cycleId: number): Promise<CaseRow[]> {
  if (!supabase) throw new Error(NOT_CONNECTED)
  const { data, error } = await supabase
    .from("cases")
    .select("id, target_id, evaluator_id, stage, answers(count)")
    .eq("cycle_id", cycleId)
  if (error) throw new Error(error.message)
  return (data as unknown as (Omit<CaseRow, "hasAnswers"> & { answers: { count: number }[] })[]).map(
    ({ answers, ...rest }) => ({ ...rest, hasAnswers: (answers[0]?.count ?? 0) > 0 }),
  )
}

export async function loadRules(): Promise<RuleRow[]> {
  if (!supabase) throw new Error(NOT_CONNECTED)
  const { data, error } = await supabase.rpc("rule_relations")
  if (error) throw new Error(error.message)
  return data as RuleRow[]
}

export async function saveRelations(cycleId: number, changes: RelationChange[]) {
  if (!supabase) throw new Error(NOT_CONNECTED)
  const { data, error } = await supabase.rpc("save_relations", {
    p_cycle_id: cycleId,
    p_changes: changes,
  })
  if (error) throw new Error(error.message)
  return data as number
}

export async function regenerateCases(cycleId: number) {
  if (!supabase) throw new Error(NOT_CONNECTED)
  const { data, error } = await supabase.rpc("regenerate_cases", { p_cycle_id: cycleId })
  if (error) throw new Error(error.message)
  return (data as { deleted: number; created: number }[])[0]
}

// 평가 건 목록 → 대상별 평가자
export function relationsOf(rows: { target_id: number; evaluator_id: number; stage: string }[]) {
  const map = new Map<number, Relation>()
  for (const row of rows) {
    const relation = map.get(row.target_id) ?? { leader: null, executive: null, upward: [] }
    if (row.stage === "leader") relation.leader = row.evaluator_id
    if (row.stage === "executive") relation.executive = row.evaluator_id
    // 상향(팀장 대상)과 임원 상향(임원 대상)은 같은 칸(upward)에 담는다. 대상 역할로 구분한다
    if (row.stage === "upward" || row.stage === "exec_upward") relation.upward = [...relation.upward, row.evaluator_id]
    map.set(row.target_id, relation)
  }
  return map
}

export const emptyRelation: Relation = { leader: null, executive: null, upward: [] }

export const sameRelation = (a: Relation, b: Relation) =>
  a.leader === b.leader &&
  a.executive === b.executive &&
  a.upward.length === b.upward.length &&
  [...a.upward].sort((x, y) => x - y).join() === [...b.upward].sort((x, y) => x - y).join()
