// 직원 화면(평가 목록·작성)의 저장소 읽기·쓰기 공통 파일 (docs/06·12)
// 공개용 열쇠 + 직원 로그인으로만 읽힌다. 안전은 저장소의 권한 규칙(002·005·006·010·011)이 지킨다.
// 관리자 화면 함수는 src/lib/admin-data.ts. 지금 회차(loadCurrentCycle)·문항(loadQuestions)은 직원도 읽을 수 있어 그 파일 것을 쓴다.
// 직원은 직원 표·남의 평가 건을 읽을 수 없어서, 대상 정보는 서버 함수(my_targets, 012의 my_case_details·my_target_self_essays)로 받는다.
import { supabase } from "@/lib/supabase"
import type { StageKey } from "@/lib/scoring"

const NOT_CONNECTED = "저장소 설정(.env.local)이 없어 불러올 수 없습니다."
const NO_PERMISSION = "권한이 없습니다. 직원 계정으로 로그인했는지 확인해 주세요."

function client() {
  if (!supabase) throw new Error(NOT_CONNECTED)
  return supabase
}

type ServerError = { code?: string; message: string }

// 012가 아직 실행되지 않아 서버 함수가 없을 때
export class NeedsSqlError extends Error {}

// 저장소 오류 → 화면 문구. 권한 규칙에 막힌 오류(42501)만 쉬운 문구로, 나머지는 저장소 문구 그대로
function serverError(error: ServerError) {
  return new Error(error.code === "42501" ? NO_PERMISSION : error.message)
}

// 저장소 시각(UTC) → 이 컴퓨터 시각 글자 (예: 2026-11-04T14:00:05)
function localText(value: string | null) {
  if (!value) return null
  const time = new Date(value)
  const two = (n: number) => String(n).padStart(2, "0")
  return `${time.getFullYear()}-${two(time.getMonth() + 1)}-${two(time.getDate())}T${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())}`
}

const num = (value: unknown) => Number(value)

// ---------- 읽기 ----------

// 내 평가 대상 목록 (사번 없음). 대상은 내부 번호로 구분한다 (003 my_targets)
export type MyTarget = {
  targetId: number
  name: string
  department: string
  position: string
  stage: StageKey
  caseId: number
  status: "not_started" | "in_progress" | "submitted" | "returned"
  previousStageDone: boolean | null // 팀장·임원 단계에서 대상의 전 단계 제출 여부 (그 밖에는 null)
}

export async function loadMyTargets(cycleId: number): Promise<MyTarget[]> {
  const { data, error } = await client().rpc("my_targets", { p_cycle_id: cycleId })
  if (error) throw serverError(error)
  return ((data ?? []) as {
    employee_id: number
    name: string
    department: string
    position: string
    my_stage: StageKey
    my_case_id: number
    my_case_status: MyTarget["status"]
    previous_stage_done: boolean | null
  }[]).map((row) => ({
    targetId: row.employee_id,
    name: row.name,
    department: row.department,
    position: row.position,
    stage: row.my_stage,
    caseId: row.my_case_id,
    status: row.my_case_status,
    previousStageDone: row.previous_stage_done,
  }))
}

// 내 평가 건의 의견·제출 시각 (평가 건은 내가 평가자인 줄만 읽힌다)
export async function loadMyCases(cycleId: number) {
  const { data, error } = await client()
    .from("cases")
    .select("id, opinion, submitted_at")
    .eq("cycle_id", cycleId)
    .order("id")
  if (error) throw serverError(error)
  return ((data ?? []) as { id: number; opinion: string | null; submitted_at: string | null }[]).map((row) => ({
    id: row.id,
    opinion: row.opinion ?? "",
    submittedAt: localText(row.submitted_at),
  }))
}

// 내 평가 건마다 문항 세트·대상 역할 (012 my_case_details). 012 전이면 NeedsSqlError
export async function loadMyCaseDetails(cycleId: number) {
  const { data, error } = await client().rpc("my_case_details", { p_cycle_id: cycleId })
  if (error) {
    // PGRST202 = 그런 함수가 없음
    if (error.code === "PGRST202") throw new NeedsSqlError("SQL 012가 아직 실행되지 않았습니다.")
    throw serverError(error)
  }
  return ((data ?? []) as { case_id: number; question_set: string; target_role: string }[]).map((row) => ({
    caseId: row.case_id,
    questionSet: row.question_set,
    targetRole: row.target_role,
  }))
}

// 팀장·임원 단계로 평가하는 사람의 자기평가 서술형 (012 my_target_self_essays). 012 전이면 빈 목록
export async function loadMyTargetSelfEssays(cycleId: number) {
  const { data, error } = await client().rpc("my_target_self_essays", { p_cycle_id: cycleId })
  if (error) {
    if (error.code === "PGRST202") return []
    throw serverError(error)
  }
  return ((data ?? []) as { my_case_id: number; question_id: number; essay: string | null; score: number | null }[]).map(
    (row) => ({
      caseId: row.my_case_id,
      questionId: row.question_id,
      essay: row.essay ?? "",
      score: row.score === null ? null : num(row.score),
    }),
  )
}

// 내 평가 건의 답
export async function loadMyAnswers(caseIds: number[]) {
  if (!caseIds.length) return []
  const { data, error } = await client()
    .from("answers")
    .select("case_id, question_id, score, essay")
    .in("case_id", caseIds)
    .order("case_id")
    .order("question_id")
  if (error) throw serverError(error)
  return ((data ?? []) as { case_id: number; question_id: number; score: number | null; essay: string | null }[]).map(
    (row) => ({
      caseId: row.case_id,
      questionId: row.question_id,
      score: row.score === null ? null : num(row.score),
      essay: row.essay,
    }),
  )
}

// 내 평가 건의 최근 반려 사유 (006 my_return_reason). 없으면 null
export async function loadMyReturnReason(caseId: number): Promise<string | null> {
  const { data, error } = await client().rpc("my_return_reason", { p_case_id: caseId })
  if (error) throw serverError(error)
  return (data as string | null) ?? null
}

// 이번 회차 만족도를 냈는지 (제출 여부는 본인 줄만 읽힌다. 내용은 읽지 않는다)
export async function loadMySatisfactionDone(cycleId: number) {
  const { data, error } = await client()
    .from("satisfaction_done")
    .select("cycle_id")
    .eq("cycle_id", cycleId)
    .limit(1)
  if (error) throw serverError(error)
  return (data ?? []).length > 0
}

// ---------- 쓰기 (평가 중일 때만: 저장소 잠금 장치 4·3이 막는다) ----------

// 답 저장: 있으면 고치고 없으면 추가 (평가 건이 작성 전·작성 중·반려일 때만)
export async function saveMyAnswers(
  caseId: number,
  answers: { questionId: number; score: number | null; essay: string | null }[],
) {
  if (!answers.length) return
  const { error } = await client()
    .from("answers")
    .upsert(
      answers.map((answer) => ({
        case_id: caseId,
        question_id: answer.questionId,
        score: answer.score,
        essay: answer.essay,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "case_id,question_id" },
    )
  if (error) throw serverError(error)
}

// 평가 건 상태 바꾸기: 임시 저장(작성 중) 또는 제출 (제출 시각은 지금)
export async function updateMyCase(
  caseId: number,
  change: { status: "in_progress" | "submitted"; opinion: string | null },
) {
  const { data, error } = await client()
    .from("cases")
    .update({
      status: change.status,
      opinion: change.opinion,
      ...(change.status === "submitted" ? { submitted_at: new Date().toISOString() } : {}),
    })
    .eq("id", caseId)
    .select("id")
  if (error) throw serverError(error)
  if (!data?.length) throw new Error("저장되지 않았습니다. 이미 제출했거나 고칠 수 없는 평가입니다.")
}

// 건의 추가: 회차·내용 두 칸만 (작성자·시각 없음). 직원은 건의를 읽을 수 없어서 select를 붙이지 않는다
export async function sendMySuggestion(cycleId: number, content: string) {
  const { error } = await client().from("suggestions").insert({ cycle_id: cycleId, content })
  if (error) throw serverError(error)
}

// 만족도 제출: 서버 함수로만 (내용은 작성자 없이, 제출 여부는 따로 한 번에 저장. 006 submit_satisfaction)
export async function submitMySatisfaction(cycleId: number, score: number, comment: string) {
  const { error } = await client().rpc("submit_satisfaction", {
    p_cycle_id: cycleId,
    p_score: score,
    p_comment: comment.trim() || null,
  })
  if (error) throw serverError(error)
}
