// 전체 결과 CSV 만들기 (새 라이브러리 없이). 관리자 전용, 전 항목.
// 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM을 붙인다.
import { round1, type StageKey } from "@/lib/scoring"
import { type ConfirmedResult } from "@/data/reports"
import { type Person } from "@/data/people"
import { type StageOpinion } from "./report-fake-opinions"

const BOM = "﻿"

const roleLabels: Record<string, string> = {
  member: "팀원",
  leader: "팀장",
  executive: "임원",
}

// 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다
const cell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

// 직원이 쓴 글(의견·건의)이 = + - @ 로 시작하면 엑셀이 수식으로 읽지 않게 앞에 ' 를 붙인다
const textCell = (value: string) => (/^[=+\-@]/.test(value) ? `'${value}` : value)

// 단계 점수 칸: 해당 없는 단계는 빈칸, 미제출은 "미제출"
const stageCell = (score: number | null, applies: boolean) =>
  !applies ? "" : score === null ? "미제출" : String(score)

const byKorean = (a: string, b: string) => a.localeCompare(b, "ko")

// 한 단계의 의견 칸: 평가자 정보 없이 내용만. 여러 개(상향)면 가나다순으로 빈 줄을 두고 잇는다
function opinionCell(opinions: StageOpinion[] | null, stage: StageKey, applies: boolean) {
  if (!applies || !opinions) return ""
  return opinions
    .filter((item) => item.stage === stage)
    .map((item) => item.opinion.trim())
    .filter(Boolean)
    .sort(byKorean)
    .map(textCell)
    .join("\n\n")
}

// 전체 결과 + 아래 구역에 건의사항.
// 건의는 익명이라 직원 줄과 연결하지 않는다: 내용만, 받은 순서가 아니라 가나다순.
export function resultsCsv(
  results: ConfirmedResult[],
  personByNo: Map<string, Person>,
  opinionsOf: (employeeNo: string) => StageOpinion[] | null,
  suggestions: string[],
) {
  // 자기평가에는 종합 의견이 없어서 의견 칸을 두지 않는다
  const header = [
    "사원번호", "이름", "부서", "직급", "역할",
    "자기평가", "팀장평가", "임원평가", "상향평가", "임원상향평가",
    "개인 평가", "비율 반영", "최종 점수",
    "팀장평가 의견", "임원평가 의견", "상향평가 의견", "임원상향평가 의견",
  ]
  const rows = results.map((result) => {
    const person = personByNo.get(result.employeeNo)
    const isLeader = person?.role === "leader"
    const isExecutive = person?.role === "executive"
    const opinions = opinionsOf(result.employeeNo)
    return [
      result.employeeNo,
      person?.name ?? "",
      result.department,
      person?.position ?? "",
      roleLabels[person?.role ?? ""] ?? "",
      stageCell(result.stages.self, !isExecutive),
      stageCell(result.stages.leader, !isLeader && !isExecutive),
      stageCell(result.stages.executive, !isExecutive),
      stageCell(result.stages.upward, isLeader),
      stageCell(result.stages.exec_upward, isExecutive),
      String(round1(result.weighted)),
      String(result.kpiApplied),
      String(result.final),
      opinionCell(opinions, "leader", !isLeader && !isExecutive),
      opinionCell(opinions, "executive", !isExecutive),
      opinionCell(opinions, "upward", isLeader),
      opinionCell(opinions, "exec_upward", isExecutive),
    ]
  })

  const sortedSuggestions = suggestions.map((item) => item.trim()).filter(Boolean).sort(byKorean)
  const suggestionRows = [
    [],
    [],
    ["건의사항 (익명 · 작성자 정보 없음 · 가나다순)"],
    ["건의 내용"],
    ...(sortedSuggestions.length
      ? sortedSuggestions.map((item) => [textCell(item)])
      : [["받은 건의가 없습니다."]]),
  ]

  return BOM + [header, ...rows, ...suggestionRows].map((row) => row.map(cell).join(",")).join("\r\n")
}

// 브라우저에서 파일로 내려받는다
export function downloadCsv(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
