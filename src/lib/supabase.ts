// 화면이 저장소(Supabase)와 연결하는 공통 파일 (docs/05-서버기반.md 4번)
// 공개용 열쇠만 쓴다. 안전은 저장소의 권한 규칙(002)이 지킨다.
// .env.local에 주소·열쇠가 없으면 연결하지 않고, 로그인은 "설정 없음"으로 실패한다.
// (역할 미리보기는 그대로 쓸 수 있다)

import { createClient } from "@supabase/supabase-js"

export type ServerRole = "member" | "leader" | "executive" | "admin"

// 계정 아이디·비밀번호 규칙은 scripts/create-accounts.mjs와 같아야 한다.
const DOMAIN = "daeyang-hr.local"
const employeeEmail = (employeeNo: string) => `${employeeNo}@${DOMAIN}`
const employeePassword = (employeeNo: string) => employeeNo.padStart(6, "0")
const adminEmail = (adminId: string) => `${adminId}@${DOMAIN}`

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey ? createClient(url, anonKey) : null

// 로그인 결과. 실패하면 화면에 보일 문구를 돌려준다.
export type LoginResult =
  | { ok: true; role: ServerRole; name: string }
  | { ok: false; message: string }

const EMPLOYEE_MISMATCH = "이름 또는 사번이 맞지 않습니다"
const ADMIN_MISMATCH = "아이디 또는 비밀번호가 맞지 않습니다"
const NO_SETTING = "저장소 설정(.env.local)이 없어 로그인할 수 없습니다"
const TRY_AGAIN = "로그인 중 문제가 생겼습니다. 잠시 후 다시 시도해 주세요"

const roles: ServerRole[] = ["member", "leader", "executive", "admin"]

export type MyProfile = { role: ServerRole; name: string }

// 로그인한 계정의 이름·역할 (my_profile). 없거나 못 읽으면 null
export async function fetchMyProfile(): Promise<MyProfile | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc("my_profile")
  if (error) return null
  const row = data?.[0]
  const role = roles.find((item) => item === row?.role)
  return role && row?.name ? { role, name: row.name } : null
}

// 이미 로그인된 계정이 있으면 그 이름·역할 (새로고침 후 이어서 쓰기)
export async function restoreProfile(): Promise<MyProfile | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (!data.session) return null
  const profile = await fetchMyProfile()
  if (!profile) await supabase.auth.signOut()
  return profile
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut()
}

// 직원: 사번으로 로그인 → 이름 확인 → 역할
// 틀리면 바로 로그아웃하고, 이름·사번 중 어느 쪽이 틀렸는지 알려 주지 않는다.
export async function signInEmployee(
  name: string,
  employeeNo: string,
): Promise<LoginResult> {
  if (!supabase) return { ok: false, message: NO_SETTING }
  const no = employeeNo.trim()
  if (!name.trim() || !/^[0-9]+$/.test(no)) {
    return { ok: false, message: EMPLOYEE_MISMATCH }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: employeeEmail(no),
    password: employeePassword(no),
  })
  if (error) {
    return { ok: false, message: error.status === 400 ? EMPLOYEE_MISMATCH : TRY_AGAIN }
  }

  const nameCheck = await supabase.rpc("check_login_name", { p_name: name.trim() })
  if (nameCheck.error || nameCheck.data !== true) {
    await supabase.auth.signOut()
    return { ok: false, message: nameCheck.error ? TRY_AGAIN : EMPLOYEE_MISMATCH }
  }

  const profile = await fetchMyProfile()
  if (!profile || profile.role === "admin") {
    await supabase.auth.signOut()
    return { ok: false, message: TRY_AGAIN }
  }
  return { ok: true, ...profile }
}

// 관리자: 아이디(admin)·비밀번호 → 관리자 표시 확인
// 직원 계정으로는 이 창에서 로그인되지 않는다.
export async function signInAdmin(
  adminId: string,
  password: string,
): Promise<LoginResult> {
  if (!supabase) return { ok: false, message: NO_SETTING }
  const id = adminId.trim()
  if (!id || id.includes("@") || !password) {
    return { ok: false, message: ADMIN_MISMATCH }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: adminEmail(id),
    password,
  })
  if (error) {
    return { ok: false, message: error.status === 400 ? ADMIN_MISMATCH : TRY_AGAIN }
  }

  const profile = await fetchMyProfile()
  if (profile?.role !== "admin") {
    await supabase.auth.signOut()
    return { ok: false, message: profile ? ADMIN_MISMATCH : TRY_AGAIN }
  }
  return { ok: true, ...profile }
}
