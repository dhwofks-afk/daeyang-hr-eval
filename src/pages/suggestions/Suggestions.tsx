// 건의함 (docs/17-건의함.md). 관리자만 본다. 건의 "내용만" 보여 준다.
// 누가 보냈는지 짐작할 수 없게 번호·작성자·시각은 없고, 받은 순서가 아니라 내용의 가나다순으로 보여 준다.
// 만족도는 직원 의견 > 만족도(src/pages/satisfaction)에서 본다.
// 관리자로 실제 로그인했으면 저장소(suggestions 표)에서, 역할 미리보기면 가짜 데이터에서 읽는다.
import { useEffect, useState } from "react"
import { Lock, MessageSquareText } from "lucide-react"
import { evaluationSetting } from "@/data/scores"
import { suggestions } from "@/data/suggestions"
import { isAdminSession, loadCurrentCycle, loadSuggestions } from "@/lib/admin-data"
import "./suggestions.css"

type Source = { round: number; name: string; contents: string[] }

const fakeSource = (): Source => ({
  round: evaluationSetting.round,
  name: evaluationSetting.name,
  contents: suggestions
    .filter((item) => item.round === evaluationSetting.round)
    .map((item) => item.content),
})

async function loadServer(): Promise<Source> {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("회차가 없습니다.")
  return { round: cycle.id, name: cycle.name, contents: await loadSuggestions(cycle.id) }
}

function Suggestions() {
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

  const round = source?.round ?? evaluationSetting.round
  const list = [...(source?.contents ?? [])].sort((a, b) => a.localeCompare(b, "ko"))

  return (
    <div className="suggestions-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <MessageSquareText size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            건의함
          </div>
          <p>직원이 자기평가 화면에서 보낸 건의입니다.</p>
        </div>
      </div>

      <section className="suggestions-summary" aria-label="건의 요약">
        <div className="suggestions-summary-top">
          <strong>{`${source?.name ?? evaluationSetting.name} (${round}회차)`}</strong>
          {source && <span>{`받은 건의 ${list.length}건`}</span>}
        </div>
        <p className="suggestions-note">
          <Lock size={18} />
          작성자와 보낸 시각은 저장되지 않아 누가 보냈는지 알 수 없습니다.
        </p>
      </section>

      {error ? (
        <p className="suggestions-empty" role="status">{`불러오지 못했습니다. (${error})`}</p>
      ) : !source ? (
        <p className="suggestions-empty">불러오는 중입니다…</p>
      ) : list.length === 0 ? (
        <p className="suggestions-empty">아직 받은 건의가 없습니다.</p>
      ) : (
        <ul className="suggestions-list">
          {list.map((content, index) => (
            // 같은 내용이 두 번 올 수 있어 자리 번호를 함께 쓴다 (화면에는 보이지 않는다)
            <li key={`${index}-${content}`} className="suggestions-card">
              {content}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Suggestions
