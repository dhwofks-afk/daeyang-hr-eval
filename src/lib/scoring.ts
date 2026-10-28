// 점수 계산 (docs/10-데이터설계.md "계산 규칙")
// 점수·보정, 리포트, 대시보드가 모두 이 파일을 불러다 쓴다. 페이지에서 점수를 직접 계산하지 않는다.
//
// 두 층으로 나눈다.
// - 아래층: 답 → 단계 점수 (규칙 1~3). 실제 데이터 연결 때 만든다.
// - 위층: 단계 점수 → 가중 합산 → KPI 반영 → 보정 → 등급 (규칙 3~8). 이 파일의 아래 함수들.
//
// 이 파일은 다른 파일을 불러오지 않는다. (가짜 데이터든 실제 데이터든 같은 함수로 계산)

// ---------- 종류 ----------

export type EvaluatedRole = "member" | "leader"
export type StageKey = "self" | "leader" | "executive" | "upward"
export type Grade = "A" | "B" | "C" | "D"

// 분야별 점수 (예: { 업무성과: 30, 능력: 17, ... }). 합이 단계 점수다.
export type FieldScores = Record<string, number>

// 단계별 분야 점수. 제출하지 않은 단계는 null.
// 팀원: 자기·팀장·임원 / 팀장: 자기·임원·상향
export type StageFieldScores = Partial<Record<StageKey, FieldScores | null>>

export type Weights = {
  member: { self: number; leader: number; executive: number }
  leader: { self: number; executive: number; upward: number }
}

export type KpiSetting = {
  method: "가산" | "배율"
  base: number
  factor: number
}

export type GradeRatio = Record<Grade, number>

export type AdjustmentRecord = {
  round: number
  employeeNo: string
  before: number
  after: number
  reason: string
  adjustedBy: string
  adjustedAt: string
}

export type ScoreInput = {
  people: { employeeNo: string; department: string; role: string }[]
  stageFieldScores: Record<string, StageFieldScores>
  departments: { name: string; kpi: number }[]
  weights: Weights
  kpi: KpiSetting
  gradeRatio: GradeRatio
  adjustments: AdjustmentRecord[]
}

export type ScoreResult = {
  employeeNo: string
  department: string
  role: EvaluatedRole
  // 단계 점수. 제출하지 않은 단계는 null (계산할 때는 0점)
  stages: Record<StageKey, number | null>
  weighted: number
  kpiApplied: number
  adjustment: number | null
  final: number
  grade: Grade
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

// ---------- 규칙 4·5: 가중 합산 ----------
// 미제출 단계는 0점으로 계산한다.
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

  // 팀장: (자기 × 20% + 임원 × 80%) × 80% + 상향 × 20%
  const w = weights.leader
  const ownScore = (score("self") * w.self + score("executive") * w.executive) / 100
  return (ownScore * (100 - w.upward) + score("upward") * w.upward) / 100
}

// ---------- 규칙 6: KPI 반영 ----------
// 결과는 0~100으로 자르고 소수 첫째 자리로 반올림한다.
export function applyKpi(score: number, departmentKpi: number, kpi: KpiSetting) {
  const gap = departmentKpi - kpi.base
  const applied =
    kpi.method === "가산"
      ? score + gap * kpi.factor
      : score * (1 + (gap * kpi.factor) / 100)
  return round1(clamp(applied, 0, 100))
}

// ---------- 규칙 7: 최종 점수 보정 ----------

// 현재 보정값 = 그 직원의 가장 최근 보정 기록. 없으면 null
export function latestAdjustment(
  records: AdjustmentRecord[],
  employeeNo: string,
) {
  const own = records.filter((record) => record.employeeNo === employeeNo)
  if (!own.length) return null
  const latest = own.reduce((last, record) =>
    record.adjustedAt >= last.adjustedAt ? record : last,
  )
  return latest.after
}

// 보정값이 있으면 그 값, 없으면 KPI 반영 점수
export const finalScore = (kpiApplied: number, adjustment: number | null) =>
  round1(adjustment ?? kpiApplied)

// ---------- 규칙 8: 등급 ----------

export const isValidGradeRatio = (ratio: GradeRatio) =>
  ratio.A + ratio.B + ratio.C + ratio.D === 100

// 누적 비율(A, A+B, A+B+C) 지점을 인원수로 바꿔 반올림한 순위.
// 예) 25·50·85% → 3명 1·2·3 / 6명 2·3·5 / 18명 5·9·15
export function gradeCutoffs(count: number, ratio: GradeRatio) {
  const cut = (percent: number) => Math.round((count * percent) / 100)
  return {
    A: cut(ratio.A),
    B: cut(ratio.A + ratio.B),
    C: cut(ratio.A + ratio.B + ratio.C),
  }
}

// 부서 안 최종 점수로 등급을 매긴다. 동점자는 같은 순위(높은 쪽)를 받는다.
export function assignGrades(
  scores: { employeeNo: string; score: number }[],
  ratio: GradeRatio,
) {
  const cutoffs = gradeCutoffs(scores.length, ratio)
  const grades = new Map<string, Grade>()
  for (const { employeeNo, score } of scores) {
    const rank = 1 + scores.filter((other) => other.score > score).length
    grades.set(
      employeeNo,
      rank <= cutoffs.A
        ? "A"
        : rank <= cutoffs.B
          ? "B"
          : rank <= cutoffs.C
            ? "C"
            : "D",
    )
  }
  return grades
}

// ---------- 한 번에 계산 ----------

// 직원마다 단계 점수 → 가중 합산 → KPI 반영 → 보정 → 등급을 계산한다.
// 팀원·팀장만 계산한다 (임원은 평가 대상이 아님).
export function computeResults(input: ScoreInput): ScoreResult[] {
  const kpiByDepartment = new Map(
    input.departments.map((department) => [department.name, department.kpi]),
  )

  const results = input.people.flatMap((person) => {
    if (person.role !== "member" && person.role !== "leader") return []
    const role: EvaluatedRole = person.role
    const fields = input.stageFieldScores[person.employeeNo] ?? {}
    const stages: Record<StageKey, number | null> = {
      self: sumFields(fields.self),
      leader: role === "member" ? sumFields(fields.leader) : null,
      executive: sumFields(fields.executive),
      upward: role === "leader" ? sumFields(fields.upward) : null,
    }
    const weighted = weightedScore(role, stages, input.weights)
    const kpiApplied = applyKpi(
      weighted,
      kpiByDepartment.get(person.department) ?? input.kpi.base,
      input.kpi,
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
        grade: "D" as Grade,
      },
    ]
  })

  // 등급은 부서 안에서 매긴다.
  for (const department of new Set(results.map((result) => result.department))) {
    const members = results.filter((result) => result.department === department)
    const grades = assignGrades(
      members.map((result) => ({ employeeNo: result.employeeNo, score: result.final })),
      input.gradeRatio,
    )
    for (const result of members) result.grade = grades.get(result.employeeNo) ?? "D"
  }

  return results
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
