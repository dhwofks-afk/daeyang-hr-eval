import { Clock, Printer } from "lucide-react"
import { participantProfiles, type ParticipantRole } from "@/data/participants"
import { people } from "@/data/people"
import { evaluationSetting } from "@/data/scores"
import {
  publishedAtLabel,
  useReportState,
  visibleResult,
} from "@/pages/reports/report-store"
import PersonalResult from "@/pages/reports/PersonalResult"
import "./my-results.css"

// 직원 "내 평가 결과"는 쓰지 않는다 (차장님 답변 11/2: 개인 리포트·평가 의견은 관리자만).
// 메뉴에서 빠졌고 주소로 들어와도 첫 페이지로 돌아간다 (routes.tsx). 파일은 나중을 위해 남겨 둔다.
// participantRole: 지금은 역할 미리보기로 고른 역할 → participants.ts의 사원번호로 본인을 찾는다.
//                  주소 목록(routes.tsx)에서 넘겨 주기 전에는 없으므로 "결과 준비 중"이 보인다.
function MyResults({ participantRole }: { participantRole?: ParticipantRole }) {
  const report = useReportState()
  const employeeNo = participantRole ? participantProfiles[participantRole].employeeNo : null
  const me = people.find((person) => person.employeeNo === employeeNo)
  const myResult = report.resultPublished
    ? report.confirmed.find((result) => result.employeeNo === employeeNo)
    : undefined

  return (
    <div className="participant-page my-results-page">
      <div className="participant-heading">
        <div>
          <span>평가 결과</span>
          <div role="heading" aria-level={1}>
            내 평가 결과
          </div>
          <p>{evaluationSetting.name}</p>
        </div>
      </div>

      {myResult && report.publishedAt ? (
        <section className="my-results-card">
          <div className="my-results-card-top">
            <span className="my-results-published">
              {`${publishedAtLabel(report.publishedAt)} 공개 · 확정 결과`}
            </span>
            <button type="button" className="my-results-print" onClick={() => window.print()}>
              <Printer size={20} />
              PDF로 저장
            </button>
          </div>
          <PersonalResult
            result={visibleResult(myResult, me?.role === "leader")}
          />
        </section>
      ) : (
        <section className="my-results-card my-results-waiting">
          <Clock size={40} strokeWidth={1.8} />
          <strong>결과 준비 중</strong>
          <p>
            {report.resultPublished
              ? "공개된 내 평가 결과가 없습니다."
              : "평가 결과가 공개되면 이곳에서 볼 수 있습니다."}
          </p>
        </section>
      )}
    </div>
  )
}

export default MyResults
