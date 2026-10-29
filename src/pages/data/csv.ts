// CSV 읽기·만들기 (새 라이브러리 없이). 엑셀에서 "CSV UTF-8"로 저장한 파일을 읽는다.
// 만들 때는 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM을 붙인다.

const BOM = "﻿"

// CSV 글 → 줄마다 칸 목록. 따옴표로 감싼 칸(쉼표·줄바꿈·"" 포함)도 읽는다
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const source = text.startsWith(BOM) ? text.slice(1) : text

  for (let i = 0; i < source.length; i++) {
    const char = source[i]
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        cell += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell)
    rows.push(row)
  }
  // 완전히 빈 줄은 뺀다
  return rows.filter((cells) => cells.some((value) => value.trim() !== ""))
}

const escape = (value: unknown) => {
  const text = value === null || value === undefined ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

// 머리줄 + 줄 목록 → CSV 글 (BOM 포함)
export function toCsv(header: string[], rows: unknown[][]) {
  return BOM + [header, ...rows].map((cells) => cells.map(escape).join(",")).join("\r\n") + "\r\n"
}

// 브라우저로 파일 내려받기
export function downloadText(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
