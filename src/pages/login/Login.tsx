import { useState } from "react"
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleHelp,
  Link2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react"
import BrandMark from "@/layout/BrandMark"
import { type UserRole } from "@/data/participants"

function Login({ onLogin }: { onLogin: (role: UserRole) => void }) {
  const [previewRole, setPreviewRole] = useState<UserRole>("member")

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand">
          <BrandMark />
          <div>
            <div className="brand-name">ROLLENT</div>
            <div className="brand-company">대양롤랜트㈜</div>
          </div>
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
            <p>사원번호와 비밀번호를 입력해 주세요.</p>
          </div>

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
          </div>

          <form
            className="login-form"
            onSubmit={(event) => {
              event.preventDefault()
              onLogin(previewRole)
            }}
          >
            <label>
              <span>사원번호</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="username"
                placeholder="사원번호 입력"
                required
              />
            </label>
            <label>
              <span>비밀번호</span>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="비밀번호 입력"
                required
              />
            </label>
            <button className="login-submit" type="submit">
              로그인
              <ArrowRight size={21} />
            </button>
          </form>

          <div className="login-help">
            <CircleHelp size={20} />
            <span>
              비밀번호를 잊은 경우 관리자에게 초기 비밀번호 재발급을 요청해
              주세요.
            </span>
          </div>

          <div className="personal-link-info">
            <Link2 size={21} />
            <div>
              <strong>개인 링크를 받으셨나요?</strong>
              <span>전달받은 링크를 열면 내 평가 목록으로 바로 연결됩니다.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Login
