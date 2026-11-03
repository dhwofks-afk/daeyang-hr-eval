// 진행 관리 > 반려 현황 (docs/08-진행관리.md 2번). 반려 기록은 읽기만 한다 (지우거나 고칠 수 없다).
// 반려 기록과 평가 건은 진행 관리 저장 자리(progress-store.ts)에서 읽는다. 응답 현황에서 반려하면 여기 바로 생긴다.
import { Undo2 } from "lucide-react"
import { type EvaluationCase } from "@/data/dashboard"
import { type ReturnLog } from "@/data/progress"
import { progressView, useProgressConnection, useProgressState } from "@/data/progress-store"
import { type StageKey } from "@/lib/scoring"
import "./progress-returns.css"

const stageNames: Record<StageKey, string> = {
  self: "자기",
  leader: "팀장",
  executive: "임원",
  upward: "상향",
  exec_upward: "임원 상향",
}

// 처리 시각 "2026-10-28T10:05" → "10/28 10:05"
const timeText = (value: string) =>
  `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))} ${value.slice(11, 16)}`

// 서버 함수 my_return_reason과 같은 순서: 처리 시각이 늦은 것, 같으면 번호가 큰 것이 먼저
const newestFirst = (a: ReturnLog, b: ReturnLog) =>
  b.returnedAt.localeCompare(a.returnedAt) || b.id - a.id

// 재제출 기한: 반려 후 3일 (화면 안내만, 서버에서 막지 않음)
// returnedAt은 이 컴퓨터 시각 글자라(저장소 시각도 한국 시각으로 바꿔 둔다) 그 날짜에 3일을 더한다
const RESUBMIT_DAYS = 3
function deadlineText(returnedAt: string, today = new Date()) {
  const [year, month, day] = returnedAt.slice(0, 10).split("-").map(Number)
  const due = new Date(year, month - 1, day)
  due.setDate(due.getDate() + RESUBMIT_DAYS)
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const days = Math.round((due.getTime() - start.getTime()) / 86_400_000)
  const date = `${due.getMonth() + 1}/${due.getDate()}`
  return days > 0 ? `${date}까지 · ${days}일 남음` : days === 0 ? `${date} · 오늘까지` : `${date} · 기한 지남`
}

type Progress = "rewriting" | "resubmitted" | "earlier"

// 지금 상태: 그 평가 건의 가장 최근 반려 기록에만 붙인다.
// 평가 건이 아직 "반려"면 재작성 중, "제출"로 돌아왔으면 재제출 완료. 같은 건의 예전 기록은 "이전 반려".
function progressOf(log: ReturnLog, item: EvaluationCase | undefined, latestId: number | undefined): Progress {
  if (log.id !== latestId) return "earlier"
  return item?.status === "returned" ? "rewriting" : "resubmitted"
}

const progressNames: Record<Progress, string> = {
  rewriting: "재작성 중",
  resubmitted: "재제출 완료",
  earlier: "이전 반려",
}

function ProgressReturns() {
  useProgressConnection()
  const progress = useProgressState()
  const { ready, cases, returnLogs, findPerson } = progressView(progress)
  const logs = [...returnLogs].sort(newestFirst)

  // 평가 건마다 가장 최근 반려 기록 번호
  const latestByCase = new Map<number, number>()
  for (const log of logs) {
    if (!latestByCase.has(log.caseId)) latestByCase.set(log.caseId, log.id)
  }

  const rows = logs.map((log) => {
    const item = cases.find((other) => other.id === log.caseId)
    return {
      log,
      item,
      target: item ? findPerson(item.targetNo) : undefined,
      evaluator: item ? findPerson(item.evaluatorNo) : undefined,
      progress: progressOf(log, item, latestByCase.get(log.caseId)),
    }
  })
  const rewriting = rows.filter((row) => row.progress === "rewriting").length

  return (
    <div className="progress-returns-page">
      <div className="detail-heading">
        <div className="detail-heading-icon">
          <Undo2 size={30} strokeWidth={1.8} />
        </div>
        <div>
          <div className="detail-area">관리자 영역</div>
          <div className="detail-title" role="heading" aria-level={1}>
            반려 현황
          </div>
          <p>제출된 평가를 되돌린 기록입니다. 반려 기록은 지우거나 고칠 수 없습니다.</p>
        </div>
      </div>

      <section className="progress-returns-summary" aria-label="반려 요약">
        <div>
          <span>반려 기록</span>
          <strong>{`${rows.length}건`}</strong>
        </div>
        <div className="progress-returns-summary-rewriting">
          <span>지금 재작성 중</span>
          <strong>{`${rewriting}건`}</strong>
        </div>
      </section>

      {!ready ? (
        <div className="progress-returns-empty" role="status">
          {progress.source === "error" ? `불러오지 못했습니다. (${progress.error})` : "불러오는 중입니다…"}
        </div>
      ) : rows.length === 0 ? (
        <div className="progress-returns-empty">아직 반려 기록이 없습니다.</div>
      ) : (
        <table className="progress-returns-table">
          <thead>
            <tr>
              <th scope="col">반려 시각</th>
              <th scope="col">평가 대상</th>
              <th scope="col">단계</th>
              <th scope="col">평가자</th>
              <th scope="col">사유</th>
              <th scope="col">처리한 사람</th>
              <th scope="col">지금 상태</th>
              <th scope="col">재제출 기한</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ log, item, target, evaluator, progress }) => (
              <tr key={log.id}>
                <td data-label="반려 시각">{timeText(log.returnedAt)}</td>
                <td data-label="평가 대상">{target?.name ?? "-"}</td>
                <td data-label="단계">{item ? stageNames[item.stage] : "-"}</td>
                <td data-label="평가자">{evaluator?.name ?? "-"}</td>
                <td data-label="사유" className="progress-returns-reason">
                  {log.reason}
                </td>
                <td data-label="처리한 사람">{log.returnedBy}</td>
                <td data-label="지금 상태">
                  <span className={`progress-returns-chip progress-returns-chip-${progress}`}>
                    {progressNames[progress]}
                  </span>
                </td>
                <td data-label="재제출 기한">{progress === "rewriting" ? deadlineText(log.returnedAt) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default ProgressReturns
