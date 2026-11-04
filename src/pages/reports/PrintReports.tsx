import { useEffect } from "react"
import { createPortal } from "react-dom"
import { type Person } from "@/data/people"
import { type ConfirmedResult } from "@/data/reports"
import { type MixRatio, type StageKey } from "@/lib/scoring"
import PersonalDashboard from "./PersonalDashboard"

// 개인 리포트 인쇄 (docs/03-리포트.md 2번). 브라우저 인쇄 창으로 PDF 저장도 된다.
// 인쇄할 사람들의 리포트를 body 바로 아래 인쇄 영역(reports-print-area)에 그리고 window.print()를 부른다.
// 인쇄하는 동안만 body에 reports-printing을 붙여, 그때만 인쇄 영역 말고 모두 숨긴다 (reports.css).
// 인쇄가 끝나면(afterprint) 영역을 비우고 문서 제목을 되돌린다.

export type PrintItem = {
  result: Pick<ConfirmedResult, "employeeNo" | "stages" | "weighted" | "kpiApplied" | "final" | "department">
  person: Person | undefined
  kpi: number
}

type Props = {
  items: PrintItem[]
  title: string // 인쇄 직전 문서 제목 = PDF 파일 이름
  cycleName: string
  mix: MixRatio
  opinions: (employeeNo: string) => { stage: StageKey; opinion: string }[] | null
  onDone: () => void
}

// 파일 이름에 쓸 수 없는 글자는 "-"로 바꾼다
export const printTitleOf = (...parts: string[]) =>
  ["개인리포트", ...parts.filter(Boolean)].join("_").replace(/[\\/:*?"<>|]/g, "-")

const todayLabel = () => {
  const now = new Date()
  return `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`
}

function PrintReports({ items, title, cycleName, mix, opinions, onDone }: Props) {
  useEffect(() => {
    const originalTitle = document.title
    let timer = 0
    let finished = false
    // 제목·숨김을 되돌린다 (개발 모드에서 화면을 두 번 그릴 때도 이것만 한다)
    const restore = () => {
      window.clearTimeout(timer)
      window.removeEventListener("afterprint", finish)
      document.body.classList.remove("reports-printing")
      document.title = originalTitle
    }
    // 인쇄가 끝나면 되돌리고 인쇄 영역을 비운다
    function finish() {
      if (finished) return
      finished = true
      restore()
      onDone()
    }

    document.title = title
    document.body.classList.add("reports-printing")
    window.addEventListener("afterprint", finish)
    // 그린 뒤에 인쇄 창을 연다. 인쇄 창이 닫히면 afterprint가 오고, 오지 않는 브라우저도 print()가 끝나면 정리한다
    timer = window.setTimeout(() => {
      window.print()
      finish()
    }, 0)

    return restore
    // 한 번 인쇄할 때마다 새로 그려진다 (Reports.tsx에서 인쇄가 끝나면 지운다)
  }, [])

  const printedAt = todayLabel()

  return createPortal(
    <div className="reports-print-area">
      {items.map(({ result, person, kpi }) => (
        <article key={result.employeeNo} className="reports-print-person">
          <header className="reports-print-header">
            <div className="reports-print-title">개인 리포트</div>
            <dl className="reports-print-meta">
              <div>
                <dt>평가</dt>
                <dd>{cycleName || "—"}</dd>
              </div>
              <div>
                <dt>이름</dt>
                <dd>{person?.name ?? result.employeeNo}</dd>
              </div>
              <div>
                <dt>부서</dt>
                <dd>{result.department}</dd>
              </div>
              <div>
                <dt>직급</dt>
                <dd>{person?.position || "—"}</dd>
              </div>
              <div>
                <dt>출력</dt>
                <dd>{printedAt}</dd>
              </div>
            </dl>
          </header>
          <PersonalDashboard
            result={result}
            role={person?.role}
            department={result.department}
            kpi={kpi}
            mix={mix}
            given={null}
            opinions={opinions(result.employeeNo)}
            showGiven={false}
          />
        </article>
      ))}
    </div>,
    document.body,
  )
}

export default PrintReports
