// 전체 결과 CSV 만들기 (새 라이브러리 없이). 관리자 전용, 전 항목.
// 엑셀에서 한글이 깨지지 않게 맨 앞에 BOM을 붙인다.
import { round1 } from "@/lib/scoring"
import { type ConfirmedResult } from "@/data/reports"
import { type Person } from "@/data/people"

const BOM = "﻿"

const roleLabels: Record<string, string> = {
  member: "팀원",
  leader: "팀장",
  executive: "임원",
}

// 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다
const cell = (value: string) =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value

// 단계 점수 칸: 해당 없는 단계는 빈칸, 미제출은 "미제출"
const stageCell = (score: number | null, applies: boolean) =>
  !applies ? "" : score === null ? "미제출" : String(score)

export function resultsCsv(
  results: ConfirmedResult[],
  personByNo: Map<string, Person>,
) {
  const header = [
    "사원번호", "이름", "부서", "직급", "역할",
    "자기평가", "팀장평가", "임원평가", "상향평가", "임원상향평가",
    "개인 평가", "비율 반영", "최종 점수",
  ]
  const rows = results.map((result) => {
    const person = personByNo.get(result.employeeNo)
    const isLeader = person?.role === "leader"
    const isExecutive = person?.role === "executive"
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
    ]
  })
  return BOM + [header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
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
