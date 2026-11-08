// 직원 의견 > 만족도. 관리자만 본다 (PC 기준).
// 상단바에서 고른 평가의 만족도: 평균 점수, 점수별(1~5) 인원, 응답률(응답 수 / 낼 사람 수), 의견 목록.
// 작성자·작성 시각은 저장되지 않는다 (익명). 의견은 받은 순서가 아니라 가나다순으로 보여 준다.
// 관리자로 실제 로그인했으면 저장소(satisfaction 표)에서, 역할 미리보기면 가짜 데이터에서 읽는다.
import { useEffect, useState } from "react"
import { Lock, Smile } from "lucide-react"
import { evaluationSetting } from "@/data/scores"
import { satisfactionAnswers, satisfactionTargetCount } from "@/data/satisfaction"
import { isAdminSession, loadCurrentCycle, loadSatisfaction } from "@/lib/admin-data"
import "./satisfaction.css"

type Source = {
  name: string
  answers: { score: number; comment: string | null }[]
  targetCount: number
}

const scoreNames: Record<number, string> = {
  1: "매우 불만족",
  2: "불만족",
  3: "보통",
  4: "만족",
  5: "매우 만족",
}

const fakeSource = (): Source => ({
  name: evaluationSetting.name,
  answers: satisfactionAnswers.filter((item) => item.round === evaluationSetting.round),
  targetCount: satisfactionTargetCount,
})

async function loadServer(): Promise<Source> {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("평가가 없습니다.")
  return { name: cycle.name, ...(await loadSatisfaction(cycle.id)) }
}

function Satisfaction() {
  const [source, setSource] = useState<Source | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    isAdminSession()
      .then((isAdmin) => (isAdmin ? loadServer() : fakeSource()))
      .then((next) => {
        if (active) setSource(next)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => {
      active = false
    }
  }, [])

  const answers = source?.answers ?? []
  const count = answers.length
  const average = count ? answers.reduce((total, item) => total + item.score, 0) / count : null
  const target = source?.targetCount ?? 0
  const rate = target ? Math.round((count / target) * 100) : 0
  const byScore = [5, 4, 3, 2, 1].map((score) => ({
    score,
    people: answers.filter((item) => item.score === score).length,
  }))
  const most = Math.max(1, ...byScore.map((item) => item.people))
  const comments = answers
    .flatMap((item) => (item.comment?.trim() ? [item.comment.trim()] : []))
    .sort((a, b) => a.localeCompare(b, "ko"))

  return (
    <div className="satisfaction-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Smile size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            만족도
          </div>
          <p>직원이 자기평가를 마치며 낸 인사평가 만족도입니다.</p>
        </div>
      </div>

      {error ? (
        <p className="satisfaction-empty" role="status">{`불러오지 못했습니다. (${error})`}</p>
      ) : !source ? (
        <p className="satisfaction-empty">불러오는 중입니다…</p>
      ) : (
        <>
          <section className="satisfaction-summary" aria-label="만족도 요약">
            <div className="satisfaction-stat">
              <span>평가</span>
              <strong className="satisfaction-name">{source.name}</strong>
            </div>
            <div className="satisfaction-stat">
              <span>평균 점수</span>
              <strong>
                {average === null ? "-" : average.toFixed(1)}
                <small> / 5</small>
              </strong>
            </div>
            <div className="satisfaction-stat">
              <span>응답률</span>
              <strong>
                {`${rate}%`}
                <small>{` (${count} / ${target}명)`}</small>
              </strong>
              <div className="satisfaction-track" role="img" aria-label={`응답률 ${rate}%`}>
                <span style={{ width: `${Math.min(rate, 100)}%` }} />
              </div>
            </div>
          </section>

          <section className="satisfaction-card" aria-label="점수별 인원">
            <div className="satisfaction-card-title">점수별 인원</div>
            {byScore.map((item) => (
              <div key={item.score} className="satisfaction-bar-row">
                <span className="satisfaction-bar-label">{`${item.score} ${scoreNames[item.score]}`}</span>
                <div className="satisfaction-track">
                  <span style={{ width: `${(item.people / most) * 100}%` }} />
                </div>
                <strong>{`${item.people}명`}</strong>
              </div>
            ))}
          </section>

          <section className="satisfaction-card" aria-label="의견">
            <div className="satisfaction-card-title">{`의견 ${comments.length}건`}</div>
            <p className="satisfaction-note">
              <Lock size={18} />
              작성자와 보낸 시각은 저장되지 않아 누가 썼는지 알 수 없습니다.
            </p>
            {comments.length === 0 ? (
              <p className="satisfaction-empty">아직 받은 의견이 없습니다.</p>
            ) : (
              <ul className="satisfaction-comments">
                {comments.map((comment, index) => (
                  // 같은 내용이 두 번 올 수 있어 자리 번호를 함께 쓴다 (화면에는 보이지 않는다)
                  <li key={`${index}-${comment}`}>{comment}</li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

export default Satisfaction
