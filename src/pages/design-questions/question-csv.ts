// 문항 엑셀(CSV) 내려받기·불러오기 (새 라이브러리 없이).
// 내려받을 때는 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM을 붙인다.
// 불러올 때는 엑셀에서 "CSV UTF-8"로 저장한 파일을 읽는다.
import type { QuestionValues } from "@/data/design"
import type { Question } from "@/data/evaluations"

const BOM = "﻿"

export const csvHeader = ["구분", "평가 내용", "배점", "문구", "유형"]

const typeNames: Record<Question["type"], string> = {
  choice: "객관식",
  essay: "서술형",
}

// 파일 → 글. 먼저 UTF-8로 읽고, UTF-8이 아니면(엑셀에서 그냥 "CSV"로 저장한 파일) euc-kr로 다시 읽는다.
// 맨 앞 BOM은 지운다 (두 번 붙은 파일도). 직원 명단(src/pages/data/csv.ts)과 같은 방식
export async function readCsvFile(file: File) {
  const bytes = await file.arrayBuffer()
  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    text = new TextDecoder("euc-kr").decode(bytes)
  }
  return text.replace(/^﻿+/, "")
}

// 엑셀 파일(.xlsx·.xls)인지. 이름만 .csv로 바꾼 엑셀 파일도 찾는다 (xlsx는 "PK", xls는 D0 CF 11 E0로 시작)
export async function isExcelFile(file: File) {
  if (/\.xlsx?$/i.test(file.name)) return true
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer())
  return (
    (head[0] === 0x50 && head[1] === 0x4b) ||
    (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0)
  )
}

// 칸 이름 비교용: 앞뒤 공백·BOM·따옴표를 지운다 (가운데 공백은 그대로, 예: "평가 내용")
const cleanHeaderCell = (cell: string) => cell.replace(/^[\s﻿"'“”‘’]+|[\s﻿"'“”‘’]+$/g, "")

// 오류 메시지에 보여 줄 "실제로 읽은 첫 줄"
const firstLineText = (cells: string[] | undefined) => {
  if (!cells) return "(빈 파일)"
  const text = cells.join(", ")
  return text.length > 200 ? `${text.slice(0, 200)}…` : text
}

// CSV 글 → 줄 목록. 줄마다 파일에서 몇 번째 줄인지(line)를 함께 둔다.
// 따옴표로 감싼 칸(쉼표·줄바꿈·"" 포함)도 읽는다.
function parseCsv(text: string) {
  const rows: { line: number; cells: string[] }[] = []
  let cells: string[] = []
  let cell = ""
  let quoted = false
  let line = 1
  let rowLine = 1
  const source = text.startsWith(BOM) ? text.slice(1) : text

  const endRow = () => {
    cells.push(cell)
    if (cells.some((value) => value.trim() !== "")) rows.push({ line: rowLine, cells })
    cells = []
    cell = ""
  }

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        if (char === "\n") line++
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      cells.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++
      endRow()
      line++
      rowLine = line
    } else {
      cell += char
    }
  }
  if (cell !== "" || cells.length) endRow()
  return rows
}

const escape = (value: string | number) => {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// 문항 목록(화면 순서) → CSV 글 (BOM 포함). 문항이 없으면 머리줄만 들어간 빈 양식이 된다.
export function questionsToCsv(list: Question[]) {
  const rows = list.map((question) => [
    question.field,
    question.factor,
    question.factorPoints,
    question.content,
    typeNames[question.type],
  ])
  return BOM + [csvHeader, ...rows].map((cells) => cells.map(escape).join(",")).join("\r\n") + "\r\n"
}

// 브라우저로 파일 내려받기
export function downloadCsv(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// CSV 글 → 문항 목록. 틀린 곳이 하나라도 있으면 문항 없이 틀린 내용만 돌려준다.
export function csvToQuestions(text: string): { questions: QuestionValues[]; problems: string[] } {
  // UTF-8·euc-kr 둘 다 아닌 형식이면 한글이 깨진 글자로 읽힌다 (readCsvFile이 두 형식은 읽는다)
  if (text.includes("�"))
    return {
      questions: [],
      problems: ["한글이 깨져 읽을 수 없습니다. 엑셀에서 'CSV UTF-8(쉼표로 분리)' 형식으로 저장해 주세요."],
    }

  const rows = parseCsv(text)
  const header = rows[0]?.cells.map(cleanHeaderCell) ?? []
  if (header.join(",") !== csvHeader.join(","))
    return {
      questions: [],
      problems: [
        `1번째 줄의 칸 이름이 양식과 다릅니다. 칸 이름은 ${csvHeader.join(", ")} 순서여야 합니다. 읽은 첫 줄: ${firstLineText(rows[0]?.cells)}`,
      ],
    }
  if (rows.length < 2) return { questions: [], problems: ["불러올 문항이 없습니다."] }

  const questions: QuestionValues[] = []
  const problems: string[] = []
  const factorPoints = new Map<string, { points: number; line: number }>()

  for (const { line, cells } of rows.slice(1)) {
    const [field = "", factor = "", pointsText = "", content = "", typeText = ""] = cells.map((cell) =>
      cell.trim(),
    )
    const points = Number(pointsText)
    const type = (Object.keys(typeNames) as Question["type"][]).find(
      (key) => typeNames[key] === typeText,
    )
    const rowProblems: string[] = []
    if (cells.length > csvHeader.length) rowProblems.push("칸이 5개보다 많습니다")
    if (!field) rowProblems.push("구분이 비어 있습니다")
    if (!factor) rowProblems.push("평가 내용이 비어 있습니다")
    if (!/^\d+$/.test(pointsText) || points < 1 || points > 100)
      rowProblems.push("배점은 1~100 사이 정수여야 합니다")
    if (!content) rowProblems.push("문구가 비어 있습니다")
    if (!type) rowProblems.push("유형은 객관식 또는 서술형이어야 합니다")

    // 배점은 평정요소 하나의 값이라, 같은 평정요소끼리 배점이 같아야 한다
    const key = `${field}\u0000${factor}`
    const same = factorPoints.get(key)
    if (field && factor && rowProblems.length === 0) {
      if (same && same.points !== points)
        rowProblems.push(`같은 평가 내용의 배점이 ${same.line}번째 줄(${same.points})과 다릅니다`)
      else if (!same) factorPoints.set(key, { points, line })
    }

    if (rowProblems.length) problems.push(`${line}번째 줄: ${rowProblems.join(", ")}`)
    else if (type) questions.push({ field, factor, factorPoints: points, content, type })
  }

  return problems.length ? { questions: [], problems } : { questions, problems }
}
