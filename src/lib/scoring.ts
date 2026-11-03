// 점수 계산 (docs/10-데이터설계.md "계산 규칙")
// 점수·보정, 리포트, 대시보드가 모두 이 파일을 불러다 쓴다. 페이지에서 점수를 직접 계산하지 않는다.
//
// 두 층으로 나눈다.
// - 아래층: 답 → 단계 점수 (규칙 1~3). 실제 데이터 연결 때 만든다.
// - 위층: 단계 점수 → 개인 평가(단계 가중 합산) → 부서 KPI·상향과 비율로 섞기 → 보정 (규칙 3~7). 이 파일의 아래 함수들.
// 상대평가 등급(A~D)은 쓰지 않는다 (차장님 답변, 11/2). 최종 점수만 쓴다.
//
// 이 파일은 다른 파일을 불러오지 않는다. (가짜 데이터든 실제 데이터든 같은 함수로 계산)

// ---------- 종류 ----------

export type EvaluatedRole = "member" | "leader" | "executive"
// exec_upward: 임원 상향 평가 (같은 부서 팀원·팀장이 임원을 평가)
export type StageKey = "self" | "leader" | "executive" | "upward" | "exec_upward"

// 분야별 점수 (예: { 업무성과: 30, 능력: 17, ... }). 합이 단계 점수다.
export type FieldScores = Record<string, number>

// 단계별 분야 점수. 제출하지 않은 단계는 null.
// 팀원: 자기·팀장·임원 / 팀장: 자기·임원·상향(제출한 팀원 평균)
// 임원: 임원 상향을 평가자 역할별로 나눠 받는다 (팀원 평균·팀장 평균). 둘을 비율로 섞어 임원 상향 점수를 만든다
export type StageFieldScores = Partial<
  Record<
    "self" | "leader" | "executive" | "upward" | "exec_upward_member" | "exec_upward_leader",
    FieldScores | null
  >
>

// 개인 평가의 단계별 비율 (합 100). 팀원: 자기·팀장·임원 / 팀장: 자기·임원
export type Weights = {
  member: { self: number; leader: number; executive: number }
  leader: { self: number; executive: number }
}

// 최종 점수를 섞는 비율 (묶음마다 합 100)
// 팀원: 개인 평가 + 부서 KPI / 팀장: 개인 평가 + 부서 KPI + 상향 평가 / 임원: 임원 상향 + 부서 KPI
// execUpward: 임원 상향 점수 = 팀원 평균 × member% + 팀장 평균 × leader%
export type MixRatio = {
  member: { personal: number; kpi: number }
  leader: { personal: number; kpi: number; upward: number }
  executive: { upward: number; kpi: number }
  execUpward: { member: number; leader: number }
}

export type AdjustmentRecord = {
  round: number
  employeeNo: string
  before: number
  // 보정 후 점수. null이면 보정 취소 (보정 없음으로 되돌림)
  after: number | null
  reason: string
  adjustedBy: string
  adjustedAt: string
}

export type ScoreInput = {
  people: {
    employeeNo: string
    department: string
    role: string
    // 평가 제외 (6개월 미만 등). 칸이 없으면 제외 아님
    excluded?: boolean
    // 재직 상태. 칸이 없으면 재직
    status?: "active" | "retired"
  }[]
  stageFieldScores: Record<string, StageFieldScores>
  departments: { name: string; kpi: number }[]
  weights: Weights
  mix: MixRatio
  adjustments: AdjustmentRecord[]
}

export type ScoreResult = {
  employeeNo: string
  department: string
  role: EvaluatedRole
  // 단계 점수. 제출하지 않은 단계는 null (계산할 때는 0점)
  stages: Record<StageKey, number | null>
  // 개인 평가 점수 (단계 가중 합산, 반올림 전). 임원은 개인 평가가 없어 임원 상향 점수
  weighted: number
  // 부서 KPI(·상향)와 비율로 섞은 점수 (보정 전, 소수 첫째 자리)
  kpiApplied: number
  adjustment: number | null
  final: number
}

// ---------- 작은 계산 ----------

// 소수 첫째 자리 반올림 (0.05는 올림)
export const round1 = (value: number) =>
  Math.round((value + Number.EPSILON) * 10) / 10

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

// 규칙 3: 단계 점수 = 분야 점수의 합. 제출하지 않은 단계는 null
export const sumFields = (fields: FieldScores | null | undefined) =>
  fields
    ? Object.values(fields).reduce((total, score) => total + score, 0)
    : null

// 상향 평가: 제출한 팀원 점수의 평균. 아무도 제출하지 않았으면 null
export const averageSubmitted = (scores: (number | null)[]) => {
  const submitted = scores.filter((score): score is number => score !== null)
  return submitted.length
    ? submitted.reduce((total, score) => total + score, 0) / submitted.length
    : null
}

// ---------- 규칙 4: 개인 평가 (단계 가중 합산) ----------
// 미제출 단계는 0점으로 계산한다.
// 팀원: 자기 × 20% + 팀장 × 40% + 임원 × 40% / 팀장: 자기 × 20% + 임원 × 80% (비율은 평가 설정 값)
export function weightedScore(
  role: EvaluatedRole,
  stages: Partial<Record<StageKey, number | null>>,
  weights: Weights,
) {
  const score = (key: StageKey) => stages[key] ?? 0

  if (role === "member") {
    const w = weights.member
    return (
      (score("self") * w.self +
        score("leader") * w.leader +
        score("executive") * w.executive) /
      100
    )
  }

  if (role === "leader") {
    const w = weights.leader
    return (score("self") * w.self + score("executive") * w.executive) / 100
  }

  // 임원: 개인 평가 단계가 없다 (임원 상향만 받는다)
  return score("exec_upward")
}

// 임원 상향 점수 = 팀원 평균 × 50% + 팀장 평균 × 50% (비율은 평가 설정 값, 미제출 쪽은 0점)
export const execUpwardScore = (memberAverage: number | null, leaderAverage: number | null, mix: MixRatio) =>
  memberAverage === null && leaderAverage === null
    ? null
    : ((memberAverage ?? 0) * mix.execUpward.member + (leaderAverage ?? 0) * mix.execUpward.leader) / 100

// ---------- 규칙 5·6: 부서 KPI·상향 평가와 비율로 섞기 ----------
// 팀원: 개인 평가 × 80% + 부서 KPI × 20%
// 팀장: 개인 평가 × 20% + 부서 KPI × 40% + 상향 평가 × 40% (상향 미제출은 0점)
// 임원: 임원 상향 × 40% + 부서 KPI × 60% (personal 자리에 임원 상향 점수를 넘긴다)
// 비율은 평가 설정 값. 결과는 0~100으로 자르고 소수 첫째 자리로 반올림한다.
export function mixScore(
  role: EvaluatedRole,
  personal: number,
  departmentKpi: number,
  upward: number | null,
  mix: MixRatio,
) {
  const mixed =
    role === "member"
      ? (personal * mix.member.personal + departmentKpi * mix.member.kpi) / 100
      : role === "leader"
        ? (personal * mix.leader.personal +
            departmentKpi * mix.leader.kpi +
            (upward ?? 0) * mix.leader.upward) /
          100
        : (personal * mix.executive.upward + departmentKpi * mix.executive.kpi) / 100
  return round1(clamp(mixed, 0, 100))
}

export const isValidWeights = (weights: Weights) =>
  weights.member.self + weights.member.leader + weights.member.executive === 100 &&
  weights.leader.self + weights.leader.executive === 100

export const isValidMix = (mix: MixRatio) =>
  mix.member.personal + mix.member.kpi === 100 &&
  mix.leader.personal + mix.leader.kpi + mix.leader.upward === 100 &&
  mix.executive.upward + mix.executive.kpi === 100 &&
  mix.execUpward.member + mix.execUpward.leader === 100

// ---------- 규칙 7: 최종 점수 보정 ----------

// 현재 보정값 = 그 직원의 가장 최근 보정 기록. 없거나 최근 기록이 취소(after가 null)면 null
export function latestAdjustment(
  records: AdjustmentRecord[],
  employeeNo: string,
) {
  // 보정 기록은 새 줄 추가만 하므로 목록의 마지막 줄이 가장 최근이다.
  // (시각 글자로 비교하지 않는다. 가짜 데이터의 미래 시각 때문에 순서가 뒤집힐 수 있다)
  // 실제 연결 때는 보정 시각 순으로 정렬해서 넘긴다.
  const own = records.filter((record) => record.employeeNo === employeeNo)
  if (!own.length) return null
  return own[own.length - 1].after
}

// 보정값이 있으면 그 값, 없으면 섞은 점수
export const finalScore = (kpiApplied: number, adjustment: number | null) =>
  round1(adjustment ?? kpiApplied)

// ---------- 한 번에 계산 ----------

// 직원마다 단계 점수 → 개인 평가 → 비율로 섞기 → 보정을 계산한다.
// 팀원·팀장·임원을 계산한다 (임원도 평가 대상, 11/3).
// 평가 제외·퇴사자는 결과에서 빠진다 (부서 평균에도 들어가지 않는다).
export function computeResults(input: ScoreInput): ScoreResult[] {
  const kpiByDepartment = new Map(
    input.departments.map((department) => [department.name, department.kpi]),
  )

  return input.people.flatMap((person) => {
    if (person.role !== "member" && person.role !== "leader" && person.role !== "executive") return []
    if (person.excluded || person.status === "retired") return []
    const role: EvaluatedRole = person.role
    const fields = input.stageFieldScores[person.employeeNo] ?? {}
    const isExec = role === "executive"
    const stages: Record<StageKey, number | null> = {
      self: isExec ? null : sumFields(fields.self),
      leader: role === "member" ? sumFields(fields.leader) : null,
      executive: isExec ? null : sumFields(fields.executive),
      upward: role === "leader" ? sumFields(fields.upward) : null,
      exec_upward: isExec
        ? execUpwardScore(sumFields(fields.exec_upward_member), sumFields(fields.exec_upward_leader), input.mix)
        : null,
    }
    const weighted = weightedScore(role, stages, input.weights)
    const kpiApplied = mixScore(
      role,
      weighted,
      kpiByDepartment.get(person.department) ?? 0,
      stages.upward,
      input.mix,
    )
    const adjustment = latestAdjustment(input.adjustments, person.employeeNo)
    return [
      {
        employeeNo: person.employeeNo,
        department: person.department,
        role,
        stages,
        weighted,
        kpiApplied,
        adjustment,
        final: finalScore(kpiApplied, adjustment),
      },
    ]
  })
}

// 부서별 최종 점수 평균 (대시보드용). 그 부서에 결과가 없으면 null
export function departmentAverage(results: ScoreResult[], department: string) {
  const finals = results
    .filter((result) => result.department === department)
    .map((result) => result.final)
  return finals.length
    ? round1(finals.reduce((total, score) => total + score, 0) / finals.length)
    : null
}
