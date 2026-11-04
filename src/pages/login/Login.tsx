import { useState } from "react"
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleHelp,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"
import BrandMark from "@/layout/BrandMark"
import { type UserRole } from "@/data/participants"
import { signInAdmin, signInEmployee } from "@/lib/supabase"
import "./login.css"

function Login({
  onLogin,
}: {
  onLogin: (role: UserRole, serverName?: string) => void
}) {
  const [previewRole, setPreviewRole] = useState<UserRole>("member")
  // 직원 로그인(이름+사번) / 관리자 로그인(아이디+비밀번호)
  const [mode, setMode] = useState<"employee" | "admin">("employee")
  const [first, setFirst] = useState("")
  const [second, setSecond] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const switchMode = (next: "employee" | "admin") => {
    setMode(next)
    setFirst("")
    setSecond("")
    setError("")
  }

  const submit = async () => {
    setBusy(true)
    setError("")
    const result =
      mode === "employee"
        ? await signInEmployee(first, second)
        : await signInAdmin(first, second)
    setBusy(false)
    if (result.ok) onLogin(result.role, result.name)
    else setError(result.message)
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <BrandMark />
        </div>
        <div className="login-message">
          <div className="eyebrow">HR PERFORMANCE EVALUATION</div>
          <div className="login-message-title" role="heading" aria-level={1}>
            공정한 평가로
            <br />
            함께 성장합니다.
          </div>
          <p>대양롤랜트㈜ 인사평가 시스템</p>
        </div>
        <div className="login-security">
          <ShieldCheck size={24} />
          <span>계정 권한에 따라 필요한 화면만 안전하게 제공됩니다.</span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <div className="login-symbol">
              <LockKeyhole size={27} />
            </div>
            <div className="login-title" role="heading" aria-level={2}>
              로그인
            </div>
            <p>
              {mode === "employee"
                ? "이름과 사원번호를 입력해 주세요."
                : "관리자 아이디와 비밀번호를 입력해 주세요."}
            </p>
          </div>

          {/* 역할 미리보기(가짜 데이터): 개발 서버(pnpm dev)에서만 보인다. 배포 사이트에는 없다 */}
          {import.meta.env.DEV && (
            <div className="role-preview">
              <div className="role-preview-label">
                <span>접속 화면 미리보기</span>
                <small>프로토타입 전용</small>
              </div>
              <div className="role-options">
                {(
                  [
                    ["member", "팀원", "자기·팀장 평가", UserRound],
                    ["leader", "팀장", "자기·팀원 평가", UsersRound],
                    ["executive", "임원", "임원 평가", BarChart3],
                  ] as const
                ).map(([value, label, description, Icon]) => (
                  <button
                    type="button"
                    key={value}
                    className={previewRole === value ? "active" : ""}
                    onClick={() => setPreviewRole(value)}
                  >
                    <Icon size={21} />
                    <span>
                      <strong>{label}</strong>
                      <small>{description}</small>
                    </span>
                    {previewRole === value && <Check size={19} />}
                  </button>
                ))}
                <button
                  type="button"
                  className={previewRole === "admin" ? "active" : ""}
                  onClick={() => setPreviewRole("admin")}
                >
                  <ShieldCheck size={21} />
                  <span>
                    <strong>관리자</strong>
                    <small>관리자 권한자</small>
                  </span>
                  {previewRole === "admin" && <Check size={19} />}
                </button>
              </div>
              <p>실제 서비스에서는 로그인한 계정의 권한으로 자동 연결됩니다.</p>
              <button
                className="login-preview-enter"
                type="button"
                onClick={() => onLogin(previewRole)}
              >
                선택한 화면 미리보기
                <ArrowRight size={19} />
              </button>
            </div>
          )}

          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <label>
              <span>{mode === "employee" ? "이름" : "아이디"}</span>
              <input
                type="text"
                autoComplete={mode === "employee" ? "name" : "username"}
                placeholder={mode === "employee" ? "이름 입력" : "아이디 입력"}
                value={first}
                onChange={(event) => setFirst(event.target.value)}
                required
              />
            </label>
            <label>
              <span>{mode === "employee" ? "사원번호" : "비밀번호"}</span>
              <input
                type="password"
                inputMode={mode === "employee" ? "numeric" : undefined}
                autoComplete={mode === "employee" ? "off" : "current-password"}
                placeholder={
                  mode === "employee" ? "사원번호 입력" : "비밀번호 입력"
                }
                value={second}
                onChange={(event) => setSecond(event.target.value)}
                required
              />
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button className="login-submit" type="submit" disabled={busy}>
              {busy ? "확인 중" : "로그인"}
              <ArrowRight size={21} />
            </button>
          </form>

          <button
            className="login-mode-link"
            type="button"
            onClick={() =>
              switchMode(mode === "employee" ? "admin" : "employee")
            }
          >
            {mode === "employee" ? "관리자 로그인" : "직원 로그인으로 돌아가기"}
          </button>

          <div className="login-help">
            <CircleHelp size={20} />
            <span>
              {mode === "employee"
                ? "로그인이 되지 않으면 인사팀에 문의해 주세요."
                : "관리자 로그인은 인사팀장 전용입니다."}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
