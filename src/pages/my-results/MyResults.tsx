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

// 로그인한 본인 결과만 보여 준다. 공개 전에는 "결과 준비 중"만.
// 공개 후에는 공개 범위에 체크된 항목만, 확정 결과 기준으로 보여 준다.
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
            result={visibleResult(myResult, me?.role === "leader", report.publicScope)}
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
