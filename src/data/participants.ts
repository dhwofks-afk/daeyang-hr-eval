export type ParticipantRole = "member" | "leader" | "executive"
export type UserRole = ParticipantRole | "admin"

export const participantProfiles: Record<
  ParticipantRole,
  { name: string; title: string; department: string; avatar: string }
> = {
  member: {
    name: "김민수",
    title: "팀원",
    department: "생산팀 · 사원",
    avatar: "김",
  },
  leader: {
    name: "박서준",
    title: "팀장",
    department: "생산팀 · 팀장",
    avatar: "박",
  },
  executive: {
    name: "이정호",
    title: "임원",
    department: "경영본부 · 상무",
    avatar: "이",
  },
}
