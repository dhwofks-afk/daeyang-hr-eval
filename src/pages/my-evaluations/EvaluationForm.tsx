// 평가 작성 화면 (/my/evaluations?case=번호). docs/06-평가작성.md 2·3번.
// 답은 저장 자리(evaluation-store.ts)에 저장한다. 점수는 계산하지 않는다.
import { useEffect, useRef, useState } from "react"
import { ChevronRight, EyeOff, Lock, RotateCcw } from "lucide-react"
import { type Person } from "@/data/people"
import { useScoreState } from "@/data/scores-store"
import { type EvaluationCase, type Question } from "@/data/evaluations"
import {
  essayModeFor,
  extrasMissingOf,
  missingOf,
  draftOf,
  progressOf,
  questionsFor,
  returnReasonOf,
  saveDraft,
  submitCase,
  targetSelfEssayOf,
  useEvaluationStore,
  writeBlockedReason,
  type Draft,
} from "./evaluation-store"
import { stageNames, statusNames } from "./evaluation-labels"
import { satisfactionElementId, SatisfactionSection, SuggestionSection } from "./EvaluationExtras"

const choiceScores = [1, 2, 3, 4, 5]

// 서술형 점수 입력: 숫자와 소수 한 자리까지만 받는다 (예: 7, 7.5)
const scorePattern = /^\d{0,3}(\.\d?)?$/

// 평가표 순서대로 분야 → 평정요소 → 문항으로 묶는다
function groupQuestions(list: Question[]) {
  const fields: { field: string; factors: { factor: string; points: number; questions: Question[] }[] }[] = []
  for (const question of list) {
    let field = fields.at(-1)
    if (field?.field !== question.field) {
      field = { field: question.field, factors: [] }
      fields.push(field)
    }
    let factor = field.factors.at(-1)
    if (factor?.factor !== question.factor) {
      factor = { factor: question.factor, points: question.factorPoints, questions: [] }
      field.factors.push(factor)
    }
    factor.questions.push(question)
  }
  return fields
}

const questionElementId = (questionId: number) => `my-evaluations-question-${questionId}`
const opinionElementId = "my-evaluations-opinion"

function EvaluationForm({
  item,
  target,
  myEmployeeNo,
  onBack,
}: {
  item: EvaluationCase
  target: Person
  myEmployeeNo: string // 로그인한 사람 (반려 사유는 평가자 본인만 볼 수 있다)
  onBack: () => void
}) {
  const store = useEvaluationStore()
  const { resultPublished } = useScoreState()
  const [draft, setDraft] = useState<Draft>(() => draftOf(store, item.id))
  // 서술형 점수 칸의 입력 글자 (입력 중인 "7." 같은 글자를 그대로 두기 위해 따로 둔다)
  const [scoreText, setScoreText] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      Object.entries(draft.answers).map(([id, answer]) => [id, answer.score?.toString() ?? ""]),
    ),
  )
  const [scoreWarning, setScoreWarning] = useState<number | null>(null)
  const [showMissing, setShowMissing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const readOnly = item.status === "submitted"
  // 저장소: 평가 중이 아니거나 SQL 012 전이면 작성할 수 없다 (그 이유). 가짜 데이터는 null
  const writeBlocked = writeBlockedReason(store)
  const needsSql = store.server?.needsSql ?? false
  const mode = essayModeFor(store, item)
  const questions = questionsFor(store, item)
  const groups = groupQuestions(questions)
  const progress = progressOf(store, item, draft)
  const missing = missingOf(store, item, draft)
  const missingIds = new Set(showMissing ? missing.questionIds : [])
  // 자기평가는 만족도 제출이 끝나야 제출된다 (docs/12 임시 결정 2)
  const extras =
    item.stage === "self" ? extrasMissingOf(store, item.targetNo) : { satisfaction: false }
  const missingCount =
    missing.questionIds.length + (missing.opinion ? 1 : 0) + (extras.satisfaction ? 1 : 0)
  const selfEssay = mode === "score" || mode === "read" ? targetSelfEssayOf(store, item) : null
  // 반려 중일 때만 보여 준다. 다시 제출하면 안내와 함께 사라진다.
  const returnReason =
    item.status === "returned" ? returnReasonOf(store, item.id, myEmployeeNo) : null

  // 화면을 열면 맨 위부터 보여 준다
  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" })
  }, [])

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const setAnswer = (questionId: number, change: Partial<Draft["answers"][number]>) => {
    setMessage("")
    setDraft((current) => {
      const previous = current.answers[questionId] ?? { score: null, essay: null }
      return {
        ...current,
        answers: { ...current.answers, [questionId]: { ...previous, ...change } },
      }
    })
  }

  // 배점보다 큰 점수나 숫자가 아닌 글자는 받지 않는다
  const changeEssayScore = (question: Question, text: string) => {
    if (!scorePattern.test(text)) return
    const value = text === "" || text === "." ? null : Number(text)
    if (value !== null && value > question.factorPoints) {
      setScoreWarning(question.id)
      return
    }
    setScoreWarning(null)
    setScoreText((current) => ({ ...current, [question.id]: text }))
    setAnswer(question.id, { score: value })
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    const failed = await saveDraft(item.id, draft)
    setBusy(false)
    setMessage(failed ?? "임시 저장했습니다.")
  }

  // 빠진 곳이 있으면 제출하지 않고 화면 순서대로 첫 번째 빠진 곳으로 이동한다
  // (문항 → 종합 의견 → 만족도)
  const trySubmit = () => {
    setMessage("")
    if (missingCount) {
      setShowMissing(true)
      const firstId = missing.questionIds.length
        ? questionElementId(missing.questionIds[0])
        : missing.opinion
          ? opinionElementId
          : satisfactionElementId
      const element = document.getElementById(firstId)
      // 만족도 칸은 화면보다 길 수 있어 칸 맨 위(제목·안내)부터 보여 준다
      const isExtra = firstId === satisfactionElementId
      element?.scrollIntoView({ block: isExtra ? "start" : "center" })
      element?.querySelector<HTMLElement>("button, input, textarea")?.focus({ preventScroll: true })
      return
    }
    setConfirming(true)
  }

  const submit = async () => {
    setConfirming(false)
    if (busy) return
    setBusy(true)
    const failed = await submitCase(item.id, draft)
    setBusy(false)
    if (failed) return setMessage(failed)
    setShowMissing(false)
    setMessage("제출했습니다.")
    topRef.current?.scrollIntoView({ block: "start" })
  }

  const essayScoreInput = (question: Question, label: string) => (
    <label className="my-evaluations-form-score">
      <span>{`${label} (0 ~ ${question.factorPoints}점)`}</span>
      <input
        type="text"
        inputMode="decimal"
        value={scoreText[question.id] ?? ""}
        disabled={readOnly}
        aria-invalid={missingIds.has(question.id)}
        onChange={(event) => changeEssayScore(question, event.target.value)}
      />
      {scoreWarning === question.id && (
        <small role="alert">{`배점(${question.factorPoints}점)보다 큰 점수는 넣을 수 없습니다.`}</small>
      )}
    </label>
  )

  // 대상의 서술 내용 (팀장·임원 화면에서 읽기만)
  const targetEssay = (showScore: boolean) =>
    selfEssay ? (
      <div className="my-evaluations-form-target-essay">
        <span>{`${target.name}님의 서술 내용`}</span>
        <p>{selfEssay.essay}</p>
        {showScore && <strong>{`자기 점수 ${selfEssay.score ?? "-"}점`}</strong>}
      </div>
    ) : (
      <div className="my-evaluations-form-target-essay my-evaluations-form-target-empty">
        아직 자기평가를 제출하지 않아 서술 내용이 없습니다.
      </div>
    )

  const essayQuestion = (question: Question) => {
    const answer = draft.answers[question.id]
    if (mode === "self") {
      return (
        <>
          <textarea
            className="my-evaluations-form-textarea"
            rows={5}
            value={answer?.essay ?? ""}
            disabled={readOnly}
            aria-label={question.content}
            aria-invalid={missingIds.has(question.id)}
            placeholder={"예) 상반기에 설비 점검 순서를 정리해 정비 대기 시간을 줄였습니다.\n신입 사원 작업 교육을 맡아 진행했습니다."}
            onChange={(event) => setAnswer(question.id, { essay: event.target.value })}
          />
          {essayScoreInput(question, "자기 점수")}
        </>
      )
    }
    if (mode === "score") {
      return (
        <>
          {targetEssay(true)}
          {essayScoreInput(question, "최종 점수")}
        </>
      )
    }
    return (
      <>
        {targetEssay(false)}
        <p className="my-evaluations-form-hint">
          <Lock size={17} />
          읽기만 할 수 있습니다. 이 서술형 점수는 바로 위 평가자가 매깁니다.
        </p>
      </>
    )
  }

  let questionNumber = 0

  return (
    <div className="participant-page my-evaluations-form" ref={topRef}>
      <button type="button" className="my-evaluations-back-button" onClick={onBack}>
        <ChevronRight size={20} />
        평가 목록으로
      </button>

      <header className="my-evaluations-form-header">
        <div className="my-evaluations-form-title">
          <div className="my-evaluations-card-top">
            <span className="my-evaluations-stage">{stageNames[item.stage]}</span>
            <span className={`my-evaluations-status my-evaluations-status-${item.status}`}>
              {statusNames[item.status]}
            </span>
          </div>
          <div role="heading" aria-level={1}>
            {item.stage === "self" ? `${target.name} (본인)` : target.name}
          </div>
          <span>{`${target.department} · ${target.position}`}</span>
        </div>
        <div className="my-evaluations-form-progress">
          <div>
            <span>진행률</span>
            <strong>{`${progress.answered} / ${progress.total}`}</strong>
          </div>
          <div className="my-evaluations-form-track">
            <span style={{ width: `${progress.total ? (progress.answered / progress.total) * 100 : 0}%` }} />
          </div>
        </div>
      </header>

      {item.status === "returned" && (
        <div className="my-evaluations-form-notice my-evaluations-form-notice-returned">
          <RotateCcw size={20} />
          <div>
            <span>관리자가 반려했습니다. 모든 문항을 다시 확인해서 반려된 날부터 3일 안에 다시 제출해 주세요.</span>
            {returnReason && (
              <p className="my-evaluations-form-return-reason">
                <strong>반려 사유</strong>
                {returnReason}
              </p>
            )}
          </div>
        </div>
      )}
      {(item.stage === "upward" || item.stage === "exec_upward") && (
        <div className="my-evaluations-form-notice">
          <EyeOff size={20} />
          {item.stage === "upward"
            ? "작성자는 관리자만 볼 수 있습니다. 팀장에게는 누가 썼는지 보이지 않습니다."
            : "작성자는 관리자만 볼 수 있습니다. 임원에게는 누가 썼는지 보이지 않습니다."}
        </div>
      )}
      {readOnly && (
        <div className="my-evaluations-form-notice my-evaluations-form-notice-done">
          <Lock size={20} />
          {message === "제출했습니다."
            ? "제출했습니다. 이제 수정할 수 없습니다."
            : "제출한 평가입니다. 수정할 수 없습니다."}
        </div>
      )}

      {!readOnly && writeBlocked && (
        <div className="my-evaluations-form-notice" role="status">
          <Lock size={20} />
          {writeBlocked}
        </div>
      )}

      {needsSql && (
        <div className="my-evaluations-form-notice" role="status">
          <Lock size={20} />
          문항을 불러오지 못했습니다. 관리자가 SQL 012를 실행한 뒤에 볼 수 있습니다.
        </div>
      )}

      {groups.map((group) => (
        <section key={group.field} className="my-evaluations-form-field">
          <h2>{group.field}</h2>
          {group.factors.map((factor) => (
            <div key={factor.factor} className="my-evaluations-form-factor">
              <div className="my-evaluations-form-factor-title">
                {/* 문항이 평가 내용과 같은 문장이면(팀장·상향 평가표) 제목은 빼고 문항에서 한 번만 보여 준다 */}
                {!factor.questions.every((question) => question.content === factor.factor) && (
                  <strong>{factor.factor}</strong>
                )}
                <span>{`배점 ${factor.points}점`}</span>
              </div>
              {factor.questions.map((question) => {
                questionNumber += 1
                const answer = draft.answers[question.id]
                return (
                  <div
                    key={question.id}
                    id={questionElementId(question.id)}
                    className={`my-evaluations-form-question ${missingIds.has(question.id) ? "my-evaluations-form-missing" : ""}`}
                  >
                    <p>
                      <span>{`${questionNumber}.`}</span>
                      {question.content}
                    </p>
                    {question.type === "choice" ? (
                      <>
                        <div
                          className="my-evaluations-form-choices"
                          role="radiogroup"
                          aria-label={`${questionNumber}번 문항 점수`}
                        >
                          {choiceScores.map((score) => (
                            <button
                              key={score}
                              type="button"
                              role="radio"
                              aria-checked={answer?.score === score}
                              disabled={readOnly}
                              onClick={() => setAnswer(question.id, { score })}
                            >
                              {score}
                            </button>
                          ))}
                        </div>
                        <div className="my-evaluations-form-scale">
                          <span>1 매우 미흡</span>
                          <span>5 매우 우수</span>
                        </div>
                      </>
                    ) : (
                      essayQuestion(question)
                    )}
                    {missingIds.has(question.id) && (
                      <small className="my-evaluations-form-missing-text">답하지 않은 문항입니다.</small>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </section>
      ))}

      {/* 종합 의견: 자기평가엔 없음, 그 외 필수 */}
      {item.stage !== "self" && (
      <section
        id={opinionElementId}
        className={`my-evaluations-form-field my-evaluations-form-opinion ${showMissing && missing.opinion ? "my-evaluations-form-missing" : ""}`}
      >
        <h2>종합 의견 (필수)</h2>
        <textarea
          className="my-evaluations-form-textarea"
          rows={4}
          value={draft.opinion}
          disabled={readOnly}
          aria-label="종합 의견"
          aria-invalid={showMissing && missing.opinion}
          placeholder="종합 의견을 한 줄 이상 적어 주세요."
          onChange={(event) => {
            setMessage("")
            setDraft((current) => ({ ...current, opinion: event.target.value }))
          }}
        />
        {showMissing && missing.opinion && (
          <small className="my-evaluations-form-missing-text">종합 의견을 적어 주세요.</small>
        )}
      </section>
      )}

      {/* 자기평가 건에서만: 건의 · 만족도 (docs/12). 버튼 위 */}
      {item.stage === "self" && (
        <>
          <SuggestionSection resultPublished={resultPublished} />
          <SatisfactionSection
            employeeNo={item.targetNo}
            resultPublished={resultPublished}
            highlight={showMissing && extras.satisfaction}
          />
        </>
      )}

      {!readOnly && (
        <div className="my-evaluations-form-actions">
          {showMissing && missingCount > 0 && (
            <p role="alert" className="my-evaluations-form-missing-text">
              {`빠진 곳 ${missingCount}곳을 채워야 제출할 수 있습니다.`}
            </p>
          )}
          {message && <p role="status">{message}</p>}
          <button
            type="button"
            className="my-evaluations-form-save"
            disabled={busy || writeBlocked !== null}
            title={writeBlocked ?? undefined}
            onClick={() => void save()}
          >
            {busy ? "저장하는 중…" : "임시 저장"}
          </button>
          <button
            type="button"
            className="my-evaluations-form-submit"
            disabled={busy || writeBlocked !== null}
            title={writeBlocked ?? undefined}
            onClick={trySubmit}
          >
            제출
          </button>
        </div>
      )}

      {confirming && (
        <div className="my-evaluations-dialog-backdrop" onClick={() => setConfirming(false)}>
          <div
            className="my-evaluations-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="my-evaluations-dialog-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.key === "Escape" && setConfirming(false)}
          >
            <strong id="my-evaluations-dialog-title">제출하면 수정할 수 없습니다</strong>
            <p>{`${target.name}님 평가(${stageNames[item.stage]})를 제출할까요?`}</p>
            <div>
              <button type="button" className="my-evaluations-form-save" onClick={() => setConfirming(false)}>
                취소
              </button>
              <button
                type="button"
                ref={confirmRef}
                className="my-evaluations-form-submit"
                disabled={busy}
                onClick={() => void submit()}
              >
                제출
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EvaluationForm
