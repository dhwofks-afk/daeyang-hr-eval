// create-accounts.mjs : 직원·관리자 로그인 계정 만들기 (docs/05-서버기반.md 4번)
//
// 본인 컴퓨터에서만 실행한다. 관리용 열쇠(.env.local)를 쓰므로 다른 곳에서 돌리지 않는다.
//   확인만:      node --env-file=.env.local scripts/create-accounts.mjs --check
//   한 명만:     node --env-file=.env.local scripts/create-accounts.mjs --only 900011
//   나머지 전부: node --env-file=.env.local scripts/create-accounts.mjs --all
//   관리자:      node --env-file=.env.local scripts/create-accounts.mjs --admin
//
// - 계정 아이디: 사번@daeyang-hr.local (내부용, 실제 메일 아님. 메일을 보내지 않는다)
// - 계정 비밀번호: 사번. 6자리 미만이면 앞에 0을 채운다 (Supabase 최소 6자리)
// - 재직 중인 직원만 만든다. 평가 제외(임원 등)도 평가자로 로그인해야 하므로 만든다.
// - 이미 연결된 직원은 건너뛴다. 여러 번 돌려도 안전하다.
// - 열쇠·비밀번호는 화면에 찍지 않는다.

import { createClient } from "@supabase/supabase-js"

const DOMAIN = "daeyang-hr.local"
const ADMIN_EMAIL = `admin@${DOMAIN}`
const ADMIN_PASSWORD_MIN = 8

// ---------- 준비 ----------

const url = process.env.VITE_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anonKey || !serviceKey) {
  console.error(
    ".env.local에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY가 모두 있어야 합니다.",
  )
  console.error("실행: node --env-file=.env.local scripts/create-accounts.mjs --check")
  process.exit(1)
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, serviceKey, noSession) // 관리용 (계정 만들기·직원 표 연결)

const emailOf = (employeeNo) => `${employeeNo}@${DOMAIN}`
const passwordOf = (employeeNo) => employeeNo.padStart(6, "0")
const label = (employee) => `${employee.employee_no} ${employee.name}`

// ---------- 작은 도구 ----------

// 직원 표 읽기 (관리용 열쇠라 권한 규칙과 상관없이 읽는다)
async function loadEmployees() {
  const { data, error } = await admin
    .from("employees")
    .select("id, employee_no, name, role, status, auth_user_id")
    .order("id")
  if (error) {
    console.error(`직원 표를 읽지 못했습니다: ${error.message}`)
    if (error.code === "42501") {
      console.error("관리용 열쇠(service_role)에 직원 표 권한이 없습니다. 이 결과를 그대로 알려 주세요.")
    }
    process.exit(1)
  }
  return data
}

// 이미 있는 로그인 계정 찾기 (아이디로)
async function findAuthUser(email) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`계정 목록을 읽지 못했습니다: ${error.message}`)
    const found = data.users.find((user) => user.email === email)
    if (found) return found
    if (data.users.length < 1000) return null
  }
}

// 직원 한 명: 계정 만들기(없으면) → 직원 표에 연결. 결과는 "created" / "linked" / "skipped"
async function createForEmployee(employee) {
  if (employee.auth_user_id) return "skipped"

  const email = emailOf(employee.employee_no)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: passwordOf(employee.employee_no),
    email_confirm: true, // 메일 확인 없이 바로 쓰는 계정
  })

  let userId = data?.user?.id
  let result = "created"
  if (error) {
    // 계정은 있는데 연결만 안 된 경우 (지난번 실행이 중간에 멈춘 경우 등)
    const existing = await findAuthUser(email)
    if (!existing) throw new Error(`계정을 만들지 못했습니다: ${error.message}`)
    userId = existing.id
    result = "linked"
  }

  const { error: linkError } = await admin
    .from("employees")
    .update({ auth_user_id: userId })
    .eq("id", employee.id)
  if (linkError) throw new Error(`직원 표에 연결하지 못했습니다: ${linkError.message}`)

  employee.auth_user_id = userId
  return result
}

// 공개용 열쇠로 실제 로그인해서 시험 (화면이 하는 것과 같은 방법)
async function testLogin(email, password, check) {
  const client = createClient(url, anonKey, noSession)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) return [`로그인 실패: ${error.message}`]

  const problems = []
  try {
    await check(client, problems)
  } finally {
    await client.auth.signOut()
  }
  return problems
}

async function testEmployeeLogin(employee) {
  return testLogin(emailOf(employee.employee_no), passwordOf(employee.employee_no), async (client, problems) => {
    const right = await client.rpc("check_login_name", { p_name: employee.name })
    if (right.error || right.data !== true) {
      problems.push(`맞는 이름 확인이 "맞음"이 아닙니다: ${right.error?.message ?? right.data}`)
    }
    const wrong = await client.rpc("check_login_name", { p_name: `${employee.name}X` })
    if (wrong.error || wrong.data !== false) {
      problems.push(`틀린 이름 확인이 "아님"이 아닙니다: ${wrong.error?.message ?? wrong.data}`)
    }
    const profile = await client.rpc("my_profile")
    const role = profile.data?.[0]?.role
    if (profile.error || role !== employee.role) {
      problems.push(`내 정보의 역할이 ${employee.role}이 아닙니다: ${profile.error?.message ?? role}`)
    }
  })
}

function report(problems, name) {
  if (problems.length) {
    console.error(`✗ ${name} 로그인 시험 실패`)
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  console.log(`✓ ${name} 로그인 시험 통과 (로그인·이름 확인 맞음/아님·역할)`)
}

// 화면에 보이지 않게 입력받기 (관리자 비밀번호)
function askHidden(prompt) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin
    if (!stdin.isTTY) {
      reject(new Error("터미널에서 직접 실행해야 비밀번호를 입력할 수 있습니다."))
      return
    }
    process.stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.setEncoding("utf8")
    stdin.resume()

    let value = ""
    const finish = () => {
      stdin.off("data", onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write("\n")
    }
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === "\r" || char === "\n") {
          finish()
          resolve(value)
          return
        }
        if (char === "\u0003") {
          // Ctrl+C
          finish()
          process.exit(1)
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1)
        else value += char
      }
    }
    stdin.on("data", onData)
  })
}

// ---------- 동작 ----------

async function check() {
  const employees = await loadEmployees()
  const targets = employees.filter((employee) => employee.status === "active")
  const linked = targets.filter((employee) => employee.auth_user_id)
  console.log(`직원 ${employees.length}명 중 계정 대상(재직) ${targets.length}명, 이미 연결 ${linked.length}명`)
  console.log(`새로 만들 계정 ${targets.length - linked.length}개`)
  const adminUser = await findAuthUser(ADMIN_EMAIL)
  console.log(`관리자 계정: ${adminUser ? "있음" : "없음"}`)
}

async function only(employeeNo) {
  if (!employeeNo) {
    console.error("사번을 함께 적어 주세요. 예) --only 900011")
    process.exit(1)
  }
  const employees = await loadEmployees()
  const employee = employees.find((row) => row.employee_no === employeeNo)
  if (!employee) {
    console.error(`사번 ${employeeNo}인 직원이 없습니다.`)
    process.exit(1)
  }
  if (employee.status !== "active") {
    console.error(`${label(employee)}은 퇴사 상태라 계정을 만들지 않습니다.`)
    process.exit(1)
  }

  const result = await createForEmployee(employee)
  const message = { created: "계정 만들고 연결", linked: "있던 계정에 연결", skipped: "이미 연결됨 (건너뜀)" }
  console.log(`${label(employee)}: ${message[result]}`)
  report(await testEmployeeLogin(employee), label(employee))
}

async function all() {
  const employees = await loadEmployees()
  const targets = employees.filter((employee) => employee.status === "active")
  const count = { created: 0, linked: 0, skipped: 0, failed: 0 }

  for (const employee of targets) {
    try {
      const result = await createForEmployee(employee)
      count[result]++
      if (result !== "skipped") console.log(`${label(employee)}: ${result === "created" ? "만듦" : "연결"}`)
    } catch (error) {
      count.failed++
      console.error(`✗ ${label(employee)}: ${error.message}`)
    }
  }

  console.log(
    `대상 ${targets.length}명 — 만듦 ${count.created} / 연결 ${count.linked} / 건너뜀 ${count.skipped} / 실패 ${count.failed}`,
  )
  if (count.failed) process.exit(1)
}

async function createAdmin() {
  if (await findAuthUser(ADMIN_EMAIL)) {
    console.error("관리자 계정이 이미 있습니다. 비밀번호를 바꾸지 않고 멈춥니다.")
    process.exit(1)
  }

  const password = await askHidden(`관리자 비밀번호 (${ADMIN_PASSWORD_MIN}자 이상, 화면에 안 보임): `)
  if (password.length < ADMIN_PASSWORD_MIN) {
    console.error(`${ADMIN_PASSWORD_MIN}자 이상이어야 합니다. 다시 실행해 주세요.`)
    process.exit(1)
  }
  if ((await askHidden("한 번 더 입력: ")) !== password) {
    console.error("두 번 입력한 비밀번호가 다릅니다. 다시 실행해 주세요.")
    process.exit(1)
  }

  const { error } = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" }, // 관리자 표시. 관리용 열쇠로만 붙일 수 있다
  })
  if (error) {
    console.error(`관리자 계정을 만들지 못했습니다: ${error.message}`)
    process.exit(1)
  }
  console.log("관리자 계정을 만들었습니다.")

  const problems = await testLogin(ADMIN_EMAIL, password, async (client, problems) => {
    const profile = await client.rpc("my_profile")
    if (profile.error || profile.data?.[0]?.is_admin !== true) {
      problems.push(`내 정보가 관리자로 나오지 않습니다: ${profile.error?.message ?? JSON.stringify(profile.data)}`)
    }
  })
  if (problems.length) {
    console.error("✗ 관리자 로그인 시험 실패")
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exit(1)
  }
  console.log("✓ 관리자 로그인 시험 통과 (로그인·관리자 표시)")
}

// ---------- 시작 ----------

const [mode, value] = process.argv.slice(2)
const actions = { "--check": check, "--only": () => only(value), "--all": all, "--admin": createAdmin }

if (!actions[mode]) {
  console.error("--check / --only 사번 / --all / --admin 중 하나를 붙여 실행해 주세요.")
  process.exit(1)
}

try {
  await actions[mode]()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
