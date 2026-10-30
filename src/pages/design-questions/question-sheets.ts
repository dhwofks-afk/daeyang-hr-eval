// 문항 편집 카드 3개 (평가표 기준). 카드 안의 버튼 하나 = 문항 세트 하나.
// 하위 주소는 지금 routes.tsx의 self / member / leader를 쓴다.
// 평가표 기준 주소(member / leader / upward)로 바뀌기 전까지 상향 평가표는 임시로 self 주소를 쓴다.
import type { QuestionSet } from "@/data/evaluations"

export type SheetKey = "member" | "leader" | "upward"

export type Sheet = {
  key: SheetKey
  title: string
  description: string
  path: string
  sets: { group: "production" | "office" | null; label: string; set: QuestionSet }[]
}

export const sheets: Sheet[] = [
  {
    key: "member",
    title: "팀원 평가표",
    description: "팀원을 평가할 때 (자기·팀장·임원 평가 공통)",
    path: "/admin/design/questions/member",
    sets: [
      { group: "production", label: "생산직", set: "production_member" },
      { group: "office", label: "관리직", set: "office_member" },
    ],
  },
  {
    key: "leader",
    title: "팀장 평가표",
    description: "팀장을 평가할 때 (자기·임원 평가 공통)",
    path: "/admin/design/questions/leader",
    sets: [
      { group: "production", label: "생산직", set: "production_leader" },
      { group: "office", label: "관리직", set: "office_leader" },
    ],
  },
  {
    key: "upward",
    title: "상향 평가표",
    description: "팀원이 팀장을 평가할 때 (익명)",
    path: "/admin/design/questions/self",
    sets: [{ group: null, label: "상향", set: "upward" }],
  },
]

// 버튼·제목에 쓰는 이름. 예) "생산직 팀원 평가표", "상향 평가표"
export const setTitle = (sheet: Sheet, set: Sheet["sets"][number]) =>
  set.group ? `${set.label} ${sheet.title}` : sheet.title

// 하위 페이지 주소. 직군은 ?group=production / office 로 넘긴다
export const setPath = (sheet: Sheet, set: Sheet["sets"][number]) =>
  set.group ? `${sheet.path}?group=${set.group}` : sheet.path
