export type ParticipantRole = "member" | "leader" | "executive"
export type UserRole = ParticipantRole | "admin"

// 역할 미리보기로 들어갈 때 보일 사람. employeeNo는 people.ts의 사원번호다.
// department는 상단바에 보일 "부서 · 직급" 표시다.
export const participantProfiles: Record<
  ParticipantRole,
  {
    employeeNo: string
    name: string
    title: string
    department: string
    avatar: string
  }
> = {
  member: {
    employeeNo: "900011",
    name: "김민수",
    title: "팀원",
    department: "생산 · 사원",
    avatar: "김",
  },
  leader: {
    employeeNo: "900010",
    name: "박서준",
    title: "팀장",
    department: "생산 · 과장",
    avatar: "박",
  },
  executive: {
    employeeNo: "900028",
    name: "이정호",
    title: "임원",
    department: "임원 · 상무",
    avatar: "이",
  },
}
