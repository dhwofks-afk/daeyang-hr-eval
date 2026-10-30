// 문항 편집 하위 화면 (평가표 하나의 문항 목록). 하위 페이지 3개가 평가표만 바꿔서 함께 쓴다.
// 직군(생산직·관리직)은 주소의 ?group= 으로 고르고, 화면 안에서도 바꿀 수 있다.
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
  currentRound,
  deleteQuestion,
  groupQuestions,
  moveQuestion,
  replaceQuestions,
  saveQuestion,
  setSummary,
  useDesignState,
  type QuestionValues,
} from "@/data/design"
import type { Question } from "@/data/evaluations"
import DesignQuestionsPreview from "./DesignQuestionsPreview"
import { csvToQuestions, downloadCsv, questionsToCsv } from "./question-csv"
import { setTitle, sheets, type SheetKey } from "./question-sheets"
import "./design-questions.css"

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
  const fields = groupQuestions(design.questions, chosen.set)
  const { count, points } = setSummary(design.questions, chosen.set)

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
    const saved = saveQuestion(
      chosen.set,
      {
        field: draft.field.trim(),
        factor: draft.factor.trim(),
        factorPoints,
        content: draft.content.trim(),
        type: draft.type,
      },
      draft.id,
    )
    if (!saved) return setDraftProblem(lockedText)
    setDraft(null)
  }

  const move = (id: number, targetId: number) => {
    if (!moveQuestion(id, targetId)) setProblem(lockedText)
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
        onClick={() => navigate("/admin/design/questions")}
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
                if (!set.group) return
                setImportProblems([])
                setSearchParams({ group: set.group })
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

      {showPreview && (
        <DesignQuestionsPreview
          choices={[{ set: chosen.set, title }]}
          questions={design.questions}
          onClose={() => setShowPreview(false)}
        />
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
                  if (!replaceQuestions(chosen.set, importing)) setProblem(lockedText)
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
                  if (!deleteQuestion(deleting.id)) setProblem(lockedText)
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
