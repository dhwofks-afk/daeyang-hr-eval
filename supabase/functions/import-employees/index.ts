// Edge Function import-employees : 직원 명단 반영 + 새 직원 로그인 계정 만들기 (docs/11-데이터관리.md 2번)
//
// 배포: Supabase 웹 > Edge Functions > 새 함수 "import-employees"를 만들고 이 파일 전체를 복사해서 붙여 넣는다.
//       원본은 언제나 이 저장소 파일이다. 고치면 저장소를 먼저 고치고 다시 붙여 넣는다.
//       "Verify JWT" 설정은 켜 둔다 (로그인한 사람만 부를 수 있음).
// 열쇠: SUPABASE_URL · SUPABASE_ANON_KEY · SUPABASE_SERVICE_ROLE_KEY는 Supabase가 함수 안에 자동으로 넣어 준다.
//       코드·파일에 열쇠를 적지 않는다.
//
// 하는 일
// 1) 부른 사람이 관리자인지 확인 (아니면 거부)
// 2) 명단을 SQL 함수 import_employees로 반영 (한 거래 — 서버가 다시 검사하고, 틀리면 아무것도 바뀌지 않음)
// 3) 로그인 계정이 없는 재직 직원의 계정을 만든다 (규칙은 scripts/create-accounts.mjs와 같다)
//    아이디: 사번@daeyang-hr.local / 비밀번호: 사번 (6자리 미만은 앞에 0)
// 4) 결과를 돌려준다: 새 n, 바뀜 n, 퇴사 n, 계정 생성 n, 계정 생성 실패 n
// 계정은 되돌릴 수 없어서 DB 반영이 끝난 뒤에 만든다. 실패한 사람은 다음에 다시 올리면 계정만 다시 만든다.

import { createClient } from "jsr:@supabase/supabase-js@2"

const DOMAIN = "daeyang-hr.local"
const emailOf = (employeeNo: string) => `${employeeNo}@${DOMAIN}`
const passwordOf = (employeeNo: string) => employeeNo.padStart(6, "0")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })

type ImportResult = {
  log_id: number
  new: number
  changed: number
  retired: number
  need_account: { id: number; employee_no: string }[]
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return reply(405, { error: "POST로만 부를 수 있습니다." })

  const url = Deno.env.get("SUPABASE_URL")
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "서버 설정이 없습니다." })

  // 1) 부른 사람 확인: 화면이 보낸 로그인 표(Authorization)로 계정을 읽어 관리자 표시를 본다
  const authorization = req.headers.get("Authorization") ?? ""
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || userData.user?.app_metadata?.role !== "admin") {
    return reply(403, { error: "관리자만 할 수 있습니다." })
  }

  let body: { rows?: unknown; retire?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: "보낸 내용을 읽을 수 없습니다." })
  }
  if (!Array.isArray(body.rows) || (body.retire !== undefined && !Array.isArray(body.retire))) {
    return reply(400, { error: "명단 형식이 맞지 않습니다." })
  }

  // 관리용 열쇠: 이 함수 안에서만 쓴다 (화면으로 내보내지 않음)
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // 2) 명단 반영 (검사는 SQL 함수가 다시 한다)
  const { data, error } = await admin.rpc("import_employees", {
    p_rows: body.rows,
    p_retire: body.retire ?? [],
  })
  if (error) return reply(400, { error: error.message })
  const result = data as ImportResult

  // 3) 로그인 계정 만들기 (이미 계정이 있으면 연결만)
  let created = 0
  const failed: string[] = []
  let existingUsers: { id: string; email?: string }[] | null = null

  for (const person of result.need_account) {
    const email = emailOf(person.employee_no)
    let userId: string | undefined

    const made = await admin.auth.admin.createUser({
      email,
      password: passwordOf(person.employee_no),
      email_confirm: true, // 실제 메일이 아니므로 확인 메일을 보내지 않는다
    })
    if (made.error) {
      // 계정은 있는데 연결만 안 된 경우
      if (!existingUsers) {
        existingUsers = []
        for (let page = 1; ; page++) {
          const list = await admin.auth.admin.listUsers({ page, perPage: 1000 })
          if (list.error) break
          existingUsers.push(...list.data.users)
          if (list.data.users.length < 1000) break
        }
      }
      userId = existingUsers.find((user) => user.email === email)?.id
    } else {
      userId = made.data.user?.id
      created++
    }

    if (!userId) {
      failed.push(person.employee_no)
      continue
    }
    const link = await admin.from("employees").update({ auth_user_id: userId }).eq("id", person.id)
    if (link.error) failed.push(person.employee_no)
  }

  await admin.rpc("set_import_account_failed", { p_log_id: result.log_id, p_failed: failed.length })

  // 4) 결과 (사번은 관리자 화면에만 가므로 실패 목록에 그대로 둔다)
  return reply(200, {
    new: result.new,
    changed: result.changed,
    retired: result.retired,
    accounts_created: created,
    accounts_failed: failed.length,
    failed_employee_nos: failed,
  })
})
