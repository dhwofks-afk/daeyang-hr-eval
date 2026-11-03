// 진행 관리용 가짜 반려 기록 (docs/08-진행관리.md, supabase/migrations/005_tables_extra.sql의 return_logs 표).
// 칸은 return_logs와 같은 뜻이다: 번호 · 평가 건 · 사유 · 처리한 사람 · 처리 시각.
// 평가 건은 dashboard.ts의 가짜 평가 건 목록을 함께 쓴다. 11/4에 실제 return_logs 표 읽기로 바꾼다.
import { evaluationCases } from "@/data/dashboard"

export type ReturnLog = {
  id: number
  caseId: number // 평가 건 번호
  reason: string // 사유 (필수)
  returnedBy: string // 처리한 사람 (서버가 채움, 지금은 "관리자")
  returnedAt: string // 처리 시각 (서버가 채움)
}

// dashboard.ts에서 "반려" 상태인 두 건 (영업부 문현우 · 생산 유가은의 자기평가)에 맞춘 기록,
// 그리고 반려된 뒤 다시 제출한 한 건 (서예린에 대한 팀장 평가: 10/24 반려 → 10/26 다시 제출). 키: 단계:대상:평가자
// 번호는 서버처럼 처리한 순서대로 붙는다.
const initialReturns: { key: string; reason: string; returnedAt: string }[] = [
  {
    key: "leader:900006:900004",
    reason: "종합 의견이 비어 있습니다. 한 줄 이상 적어 다시 제출해 주세요.",
    returnedAt: "2026-10-24T16:20",
  },
  {
    key: "self:900007:900007",
    reason: "주요 활동 및 성과 기재란이 비어 있습니다. 내용을 적어 다시 제출해 주세요.",
    returnedAt: "2026-10-28T10:05",
  },
  {
    key: "self:900020:900020",
    reason: "자기 점수가 배점과 맞지 않아 보입니다. 다시 확인해 주세요.",
    returnedAt: "2026-10-28T14:30",
  },
]

export const returnLogs: ReturnLog[] = initialReturns.flatMap((entry, index) => {
  const item = evaluationCases.find(
    (other) => `${other.stage}:${other.targetNo}:${other.evaluatorNo}` === entry.key,
  )
  return item
    ? [
        {
          id: index + 1,
          caseId: item.id,
          reason: entry.reason,
          returnedBy: "관리자",
          returnedAt: entry.returnedAt,
        },
      ]
    : []
})
