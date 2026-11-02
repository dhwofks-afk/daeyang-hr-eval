// 건의함 (docs/15-건의함.md). 관리자만 본다. 건의 "내용만" 보여 준다.
// 누가 보냈는지 짐작할 수 없게 번호·작성자·시각은 없고, 받은 순서가 아니라 내용의 가나다순으로 보여 준다.
// 만족도는 관리자 화면을 만들지 않는다.
import { Lock, MessageSquareText } from "lucide-react"
import { evaluationSetting } from "@/data/scores"
import { suggestions } from "@/data/suggestions"
import "./suggestions.css"

function Suggestions() {
  const round = evaluationSetting.round
  const list = suggestions
    .filter((item) => item.round === round)
    .map((item) => item.content)
    .sort((a, b) => a.localeCompare(b, "ko"))

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
          <strong>{`${evaluationSetting.name} (${round}회차)`}</strong>
          <span>{`받은 건의 ${list.length}건`}</span>
        </div>
        <p className="suggestions-note">
          <Lock size={18} />
          작성자와 보낸 시각은 저장되지 않아 누가 보냈는지 알 수 없습니다.
        </p>
      </section>

      {list.length === 0 ? (
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
