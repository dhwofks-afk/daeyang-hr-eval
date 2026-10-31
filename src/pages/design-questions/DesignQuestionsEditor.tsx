// 문항 편집 하위 화면 (평가표 하나의 문항 목록). 하위 페이지 3개가 평가표만 바꿔서 함께 쓴다.
// 직군(생산직·관리직)은 주소의 ?group= 으로 고르고, 화면 안에서도 바꿀 수 있다.
// 수정·삭제·추가·순서 변경·엑셀 불러오기는 지금 보고 있는 탭의 작업 사본에만 하고, [완료]를 눌러야 저장된다.
// 미리보기와 문항 편집 카드는 저장된 문항을 보여 주므로 [완료] 전에는 원래 문항이 보인다.
import { useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Download,
  Eye,
  FileUp,
  GripVertical,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import {
  commitQuestionSet,
  currentRound,
  groupQuestions,
  setSummary,
  useDesignState,
  withMovedQuestion,
  withoutQuestion,
  withReplacedSet,
  withSavedQuestion,
  type QuestionValues,
} from "@/data/design"
import type { Question, QuestionSet } from "@/data/evaluations"
import DesignQuestionsPreview from "./DesignQuestionsPreview"
import { useLeaveGuard } from "./leave-guard"
import { csvToQuestions, downloadCsv, questionsToCsv } from "./question-csv"
import { setTitle, sheets, type SheetKey } from "./question-sheets"
import "./design-questions.css"

// 작업 사본과 저장된 문항이 같은지 (순서·내용·배점·번호)
const sameQuestions = (a: Question[], b: Question[]) => {
  const key = (list: Question[]) =>
    JSON.stringify(
      [...list]
        .sort((x, y) => x.sortOrder - y.sortOrder)
        .map(({ id, field, factor, factorPoints, content, type, sortOrder }) => [
          id,
          field,
          factor,
          factorPoints,
          content,
          type,
          sortOrder,
        ]),
    )
  return key(a) === key(b)
}

// 문항 추가·수정 창의 입력값 (배점은 입력 중 글자로 둔다)
type Draft = {
  id?: number
  field: string
  factor: string
  points: string
  content: string
  type: Question["type"]
}

const typeLabel: Record<Question["type"], string> = {
  choice: "객관식 5점",
  essay: "서술형",
}

function DesignQuestionsEditor({ sheetKey }: { sheetKey: SheetKey }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const design = useDesignState()
  const sheet = sheets.find((item) => item.key === sheetKey) ?? sheets[0]
  const chosen = sheet.sets.find((set) => set.group === searchParams.get("group")) ?? sheet.sets[0]
  const title = setTitle(sheet, chosen)
  const locked = currentRound(design).status !== "평가 전"

  // 작업 사본: 지금 탭(세트)의 문항만. [완료]를 누르기 전까지 저장 자리는 그대로다
  const [working, setWorking] = useState<{ set: QuestionSet; questions: Question[] } | null>(null)
  const savedSet = design.questions.filter((question) => question.questionSet === chosen.set)
  const workingSet = working?.set === chosen.set ? working.questions : null
  // 화면 목록은 작업 사본으로 그린다 (다른 세트는 저장된 그대로)
  const list = workingSet
    ? [...design.questions.filter((question) => question.questionSet !== chosen.set), ...workingSet]
    : design.questions
  const fields = groupQuestions(list, chosen.set)
  const { count, points } = setSummary(list, chosen.set)
  const dirty = workingSet !== null && !sameQuestions(workingSet, savedSet)

  // 저장하지 않은 수정이 있을 때 나가려 하면 먼저 묻는다 (탭 바꾸기·사이드바·뒤로 가기·새로고침)
  const [leaving, setLeaving] = useState<(() => void) | null>(null)
  const guard = useLeaveGuard(dirty, (leave) => setLeaving(() => leave))

  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftProblem, setDraftProblem] = useState("")
  const [deleting, setDeleting] = useState<Question | null>(null)
  const [dragging, setDragging] = useState<Question | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [problem, setProblem] = useState("")
  const [importing, setImporting] = useState<QuestionValues[] | null>(null)
  const [importProblems, setImportProblems] = useState<string[]>([])
  const fileInput = useRef<HTMLInputElement>(null)

  const lockedText = "평가가 시작되어 문항을 수정할 수 없습니다."

  // 고친 목록을 작업 사본에 넣는다 (지금 탭의 문항만 남긴다). 고칠 수 없으면 false
  const applyEdit = (next: Question[] | null) => {
    if (locked) {
      setProblem(lockedText)
      return false
    }
    if (!next) return false
    setWorking({
      set: chosen.set,
      questions: next.filter((question) => question.questionSet === chosen.set),
    })
    return true
  }

  // [완료]: 지금 탭의 작업 사본만 저장한다
  const finish = () => {
    if (locked) return setProblem(lockedText)
    if (workingSet && dirty) {
      guard.release()
      if (!commitQuestionSet(chosen.set, workingSet)) return setProblem(lockedText)
    }
    setWorking(null)
  }

  // 다른 탭으로: 저장하지 않은 수정이 있으면 묻고, 확인하면 이 탭의 수정을 버린다
  const switchGroup = (group: string) => {
    setImportProblems([])
    if (!dirty) return setSearchParams({ group })
    setLeaving(() => () => {
      guard.forget()
      setWorking(null)
      setSearchParams({ group }, { replace: true })
    })
  }

  // 문항 편집 목록으로 돌아가기: 저장하지 않은 수정이 있으면 묻는다
  const goBack = () => {
    if (!dirty) return navigate("/admin/design/questions")
    setLeaving(() => () => navigate("/admin/design/questions"))
  }

  const openDraft = (next: Draft) => {
    setProblem("")
    setDraftProblem("")
    setDraft(next)
  }

  // 이미 있는 평정요소를 고르면 그 배점을 채워 준다
  const factorPointsOf = (field: string, factor: string) =>
    fields
      .find((item) => item.field === field)
      ?.factors.find((item) => item.factor === factor)?.points

  const saveDraft = () => {
    if (!draft) return
    const factorPoints = Number(draft.points)
    if (!draft.field.trim()) return setDraftProblem("분야를 입력해 주세요.")
    if (!draft.factor.trim()) return setDraftProblem("평정요소를 입력해 주세요.")
    if (!Number.isInteger(factorPoints) || factorPoints < 1 || factorPoints > 100)
      return setDraftProblem("평정요소 배점은 1~100 사이 정수로 입력해 주세요.")
    if (!draft.content.trim()) return setDraftProblem("문구를 입력해 주세요.")
    if (locked) return setDraftProblem(lockedText)
    applyEdit(
      withSavedQuestion(
        list,
        chosen.set,
        {
          field: draft.field.trim(),
          factor: draft.factor.trim(),
          factorPoints,
          content: draft.content.trim(),
          type: draft.type,
        },
        draft.id,
      ),
    )
    setDraft(null)
  }

  const move = (id: number, targetId: number) => {
    applyEdit(withMovedQuestion(list, id, targetId))
  }

  // 지금 문항을 그대로 담은 양식을 내려받는다 (문항이 없으면 칸 이름만 있는 빈 양식)
  const downloadSheet = () => {
    const list = fields.flatMap((field) => field.factors.flatMap((factor) => factor.questions))
    downloadCsv(`${title} 문항.csv`, questionsToCsv(list))
  }

  const readFile = async (file: File) => {
    setProblem("")
    setImportProblems([])
    if (!file.name.toLowerCase().endsWith(".csv"))
      return setImportProblems(["CSV 파일만 불러올 수 있습니다. 엑셀에서 CSV로 저장한 뒤 올려 주세요."])
    const result = csvToQuestions(await file.text())
    if (result.problems.length) return setImportProblems(result.problems)
    setImporting(result.questions)
  }

  let number = 0

  return (
    <div className="design-questions-page">
      <button
        type="button"
        className="design-questions-back"
        onClick={goBack}
      >
        <ArrowLeft size={19} />
        문항 편집으로
      </button>

      <div className="design-questions-heading">
        <div className="detail-heading">
          <div>
            <div className="detail-area">평가 설계</div>
            <div className="detail-title" role="heading" aria-level={1}>
              {title} 문항 편집
            </div>
            <p>{sheet.description}</p>
          </div>
        </div>
        <button type="button" className="preview-button" onClick={() => setShowPreview(true)}>
          <Eye size={19} />
          미리보기
        </button>
      </div>

      {sheet.sets.length > 1 && (
        <div className="design-questions-groups" role="group" aria-label="직군 고르기">
          {sheet.sets.map((set) => (
            <button
              type="button"
              key={set.set}
              className={set.set === chosen.set ? "active" : ""}
              aria-pressed={set.set === chosen.set}
              onClick={() => {
                if (!set.group || set.set === chosen.set) return
                switchGroup(set.group)
              }}
            >
              {set.label}
            </button>
          ))}
        </div>
      )}

      {locked && (
        <div className="design-questions-lock">
          <LockKeyhole size={22} />
          <div>
            <strong>평가가 시작되어 문항 편집이 잠겼습니다.</strong>
            <span>평가 중이거나 끝난 평가의 문항은 바꿀 수 없습니다.</span>
          </div>
        </div>
      )}

      {problem && (
        <div className="design-questions-message" role="alert">
          {problem}
        </div>
      )}

      <section className="design-questions-editor">
        <div className="design-questions-summary">
          <div>
            <strong>{title}</strong>
            <span className={points === 100 ? "" : "wrong"}>
              문항 {count}개 · 배점 합계 {points}
              {points !== 100 && " (100이어야 평가를 시작할 수 있습니다)"}
            </span>
          </div>
          <button
            type="button"
            className="design-questions-button primary"
            disabled={locked}
            onClick={() =>
              openDraft({ field: "", factor: "", points: "", content: "", type: "choice" })
            }
          >
            <Plus size={19} />
            문항 추가
          </button>
        </div>

        <div className="design-questions-excel">
          <div className="design-questions-excel-buttons">
            <button type="button" className="design-questions-button" onClick={downloadSheet}>
              <Download size={19} />
              엑셀 양식 다운로드
            </button>
            <button
              type="button"
              className="design-questions-button"
              disabled={locked}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp size={19} />
              엑셀 문항 불러오기
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void readFile(file)
                event.target.value = ""
              }}
            />
          </div>
          <p className="design-questions-excel-note">
            엑셀 파일은 [다른 이름으로 저장]에서 "CSV UTF-8(쉼표로 분리)"로 저장한 뒤 불러와 주세요.
            칸은 분야, 평정요소, 배점, 문구, 유형(객관식·서술형)이고, 배점은 평정요소의 배점입니다.
          </p>
          {importProblems.length > 0 && (
            <div className="design-questions-excel-problems" role="alert">
              <strong>파일에 틀린 곳이 있어 반영하지 않았습니다. 고쳐서 다시 불러와 주세요.</strong>
              <ul>
                {importProblems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {fields.length === 0 && (
          <p className="design-questions-empty">등록된 문항이 없습니다. [문항 추가]로 넣어 주세요.</p>
        )}

        {fields.map((field) => (
          <div className="design-questions-field" key={field.field}>
            <div className="design-questions-field-head">
              <strong>{field.field}</strong>
              <span>{field.points}점</span>
            </div>
            {field.factors.map((factor) => (
              <div className="design-questions-factor" key={factor.factor}>
                <div className="design-questions-factor-head">
                  <strong>{factor.factor}</strong>
                  <span>배점 {factor.points}</span>
                </div>
                {factor.questions.map((question, index) => {
                  number += 1
                  const previous = factor.questions[index - 1]
                  const next = factor.questions[index + 1]
                  const canDrop =
                    dragging !== null &&
                    dragging.id !== question.id &&
                    dragging.field === question.field &&
                    dragging.factor === question.factor
                  return (
                    <div
                      key={question.id}
                      className={`design-questions-row ${dragging?.id === question.id ? "dragging" : ""}`}
                      draggable={!locked}
                      onDragStart={() => setDragging(question)}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(event) => canDrop && event.preventDefault()}
                      onDrop={() => {
                        if (canDrop && dragging) move(dragging.id, question.id)
                        setDragging(null)
                      }}
                    >
                      <div className="design-questions-order">
                        {!locked && <GripVertical size={18} aria-hidden="true" />}
                        <span className="design-questions-number">{number}</span>
                      </div>
                      <div className="design-questions-copy">
                        <p>{question.content}</p>
                        <span className={`design-questions-type ${question.type}`}>
                          {typeLabel[question.type]}
                        </span>
                      </div>
                      <div className="design-questions-actions">
                        <button
                          type="button"
                          disabled={locked || !previous}
                          onClick={() => previous && move(question.id, previous.id)}
                          aria-label={`${number}번 문항 위로`}
                        >
                          <ArrowUp size={18} />
                        </button>
                        <button
                          type="button"
                          disabled={locked || !next}
                          onClick={() => next && move(question.id, next.id)}
                          aria-label={`${number}번 문항 아래로`}
                        >
                          <ArrowDown size={18} />
                        </button>
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() =>
                            openDraft({
                              id: question.id,
                              field: question.field,
                              factor: question.factor,
                              points: String(question.factorPoints),
                              content: question.content,
                              type: question.type,
                            })
                          }
                        >
                          <Pencil size={18} />
                          수정
                        </button>
                        <button
                          type="button"
                          className="danger"
                          disabled={locked}
                          onClick={() => {
                            setProblem("")
                            setDeleting(question)
                          }}
                        >
                          <Trash2 size={18} />
                          삭제
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </section>

      <div className="design-questions-done">
        <button
          type="button"
          className="design-questions-button primary"
          disabled={locked}
          onClick={finish}
        >
          완료
        </button>
      </div>

      {/* 미리보기는 저장된 문항(design.questions)을 보여 준다: [완료] 전에는 원래 문항 */}
      {showPreview && (
        <DesignQuestionsPreview
          choices={[{ set: chosen.set, title }]}
          questions={design.questions}
          onClose={() => setShowPreview(false)}
        />
      )}

      {leaving && (
        <div className="design-questions-backdrop" role="presentation">
          <div
            className="design-questions-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="design-questions-leave-title"
          >
            <span className="design-questions-modal-icon">
              <AlertTriangle size={28} />
            </span>
            <div
              id="design-questions-leave-title"
              className="design-questions-modal-title"
              role="heading"
              aria-level={2}
            >
              저장하지 않은 수정이 있어요. 나갈까요?
            </div>
            <div className="design-questions-modal-actions">
              <button type="button" className="design-questions-button" onClick={() => setLeaving(null)}>
                취소
              </button>
              <button
                type="button"
                className="design-questions-button primary"
                onClick={() => {
                  const leave = leaving
                  setLeaving(null)
                  setWorking(null)
                  leave()
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {draft && (
        <div className="design-questions-backdrop" role="presentation">
          <div
            className="design-questions-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="design-questions-draft-title"
          >
            <div
              id="design-questions-draft-title"
              className="design-questions-modal-title"
              role="heading"
              aria-level={2}
            >
              {draft.id ? "문항 수정" : "새 문항 추가"}
            </div>

            <label className="design-questions-input">
              <span>분야</span>
              <input
                list="design-questions-field-options"
                value={draft.field}
                placeholder="목록에서 고르거나 새로 입력"
                onChange={(event) => setDraft({ ...draft, field: event.target.value })}
              />
              <datalist id="design-questions-field-options">
                {fields.map((field) => (
                  <option key={field.field} value={field.field} />
                ))}
              </datalist>
            </label>

            <div className="design-questions-input-row">
              <label className="design-questions-input">
                <span>평정요소</span>
                <input
                  list="design-questions-factor-options"
                  value={draft.factor}
                  placeholder="목록에서 고르거나 새로 입력"
                  onChange={(event) => {
                    const factor = event.target.value
                    const existing = factorPointsOf(draft.field.trim(), factor.trim())
                    setDraft({
                      ...draft,
                      factor,
                      points: existing === undefined ? draft.points : String(existing),
                    })
                  }}
                />
                <datalist id="design-questions-factor-options">
                  {fields
                    .find((field) => field.field === draft.field.trim())
                    ?.factors.map((factor) => (
                      <option key={factor.factor} value={factor.factor} />
                    ))}
                </datalist>
              </label>
              <label className="design-questions-input points">
                <span>평정요소 배점</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={draft.points}
                  onChange={(event) => setDraft({ ...draft, points: event.target.value })}
                />
              </label>
            </div>
            <small className="design-questions-hint">
              평정요소 배점은 같은 평정요소의 모든 문항에 함께 적용됩니다.
            </small>

            <label className="design-questions-input">
              <span>문구</span>
              <textarea
                value={draft.content}
                placeholder="평가하는 사람에게 보일 문항 문구"
                onChange={(event) => setDraft({ ...draft, content: event.target.value })}
              />
            </label>

            <fieldset className="design-questions-type-field">
              <legend>응답 형식</legend>
              <div className="design-questions-type-options">
                {(
                  [
                    ["choice", "객관식", "1점부터 5점까지 선택"],
                    ["essay", "서술형", "내용을 직접 입력"],
                  ] as const
                ).map(([value, label, description]) => (
                  <button
                    type="button"
                    key={value}
                    className={draft.type === value ? "active" : ""}
                    aria-pressed={draft.type === value}
                    onClick={() => setDraft({ ...draft, type: value })}
                  >
                    <strong>{label}</strong>
                    <small>{description}</small>
                  </button>
                ))}
              </div>
            </fieldset>

            {draftProblem && (
              <div className="design-questions-message" role="alert">
                {draftProblem}
              </div>
            )}

            <div className="design-questions-modal-actions">
              <button type="button" className="design-questions-button" onClick={() => setDraft(null)}>
                취소
              </button>
              <button type="button" className="design-questions-button primary" onClick={saveDraft}>
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {importing && (
        <div className="design-questions-backdrop" role="presentation">
          <div
            className="design-questions-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="design-questions-import-title"
            aria-describedby="design-questions-import-description"
          >
            <span className="design-questions-modal-icon">
              <AlertTriangle size={28} />
            </span>
            <div
              id="design-questions-import-title"
              className="design-questions-modal-title"
              role="heading"
              aria-level={2}
            >
              문항을 바꾸시겠습니까?
            </div>
            <p id="design-questions-import-description" className="design-questions-delete-text">
              현재 문항 {count}개를 불러온 문항 {importing.length}개로 바꿉니다.
              <br />
              {title}의 기존 문항은 모두 지워집니다.
            </p>
            <div className="design-questions-modal-actions">
              <button type="button" className="design-questions-button" onClick={() => setImporting(null)}>
                취소
              </button>
              <button
                type="button"
                className="design-questions-button primary"
                onClick={() => {
                  applyEdit(withReplacedSet(list, chosen.set, importing))
                  setImporting(null)
                }}
              >
                바꾸기
              </button>
            </div>
          </div>
        </div>
      )}

      {deleting && (
        <div className="design-questions-backdrop" role="presentation">
          <div
            className="design-questions-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="design-questions-delete-title"
            aria-describedby="design-questions-delete-description"
          >
            <span className="design-questions-modal-icon">
              <AlertTriangle size={28} />
            </span>
            <div
              id="design-questions-delete-title"
              className="design-questions-modal-title"
              role="heading"
              aria-level={2}
            >
              이 문항을 삭제하시겠습니까?
            </div>
            <p id="design-questions-delete-description" className="design-questions-delete-text">
              {deleting.field} · {deleting.factor}
              <br />
              {deleting.content}
            </p>
            <div className="design-questions-modal-actions">
              <button type="button" className="design-questions-button" onClick={() => setDeleting(null)}>
                취소
              </button>
              <button
                type="button"
                className="design-questions-button danger"
                onClick={() => {
                  applyEdit(withoutQuestion(list, deleting.id))
                  setDeleting(null)
                }}
              >
                <Trash2 size={18} />
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DesignQuestionsEditor
