// 리포트 화면들이 함께 쓰는 자료 (docs/03-리포트.md)
// 관리자로 실제 로그인했으면 저장소(src/lib/admin-data.ts), 역할 미리보기면 가짜 데이터(report-store·scores-store)를 쓴다.
// 점수는 scoring.ts로 계산한다. 결과 확정 때만 확정 결과 표(final_results)에 저장한다.
import { useCallback, useEffect, useState } from "react"
import { type Person } from "@/data/people"
import { reportSetting, type ConfirmedResult } from "@/data/reports"
import { personByNo as fakePersonByNo, scoreResults, useScoreState } from "@/data/scores-store"
import { givenUpwardScores, type MixRatio, type ScoreResult, type StageKey } from "@/lib/scoring"
import {
  isAdminSession,
  loadCurrentCycle,
  loadFinalResults,
  loadScoreData,
  publishResults,
  scoreResultsOf,
  unpublishResults,
  type AdminCycle,
  type AdminPerson,
  type ScoreData,
} from "@/lib/admin-data"
import { cancelConfirm, confirmResults, useReportState } from "./report-store"

export type ReportSource = {
  status: "loading" | "ready" | "error"
  error: string | null
  round: number
  published: boolean // 결과 확정
  publishedAt: string | null
  liveResults: ScoreResult[] // 지금 점수로 계산한 결과
  confirmed: ConfirmedResult[] // 확정 결과 (확정 취소해도 남는다)
  personByNo: Map<string, Person>
  departmentKpi: Record<string, number> // 부서명 → KPI 점수
  mix: MixRatio // 최종 점수 비율
  // 본인이 평가자로 낸 상향·임원 상향 평가. 역할 미리보기처럼 자료가 없으면 null
  givenUpward: (employeeNo: string) => GivenUpward[] | null
  // 받은 평가의 종합 의견 (평가자 없이 단계만). 자료가 없으면 null
  opinions: (employeeNo: string) => { stage: StageKey; opinion: string }[] | null
  // 처리하지 못하면 화면에 보일 문구, 되면 null
  confirm: () => Promise<string | null>
  cancel: () => Promise<string | null>
}

export type GivenUpward = { targetName: string; stage: StageKey; score: number | null }

type ServerState = {
  cycle: AdminCycle
  people: AdminPerson[]
  data: ScoreData
  live: ScoreResult[]
  confirmed: ConfirmedResult[]
}

async function loadServer(): Promise<ServerState> {
  const cycle = await loadCurrentCycle()
  if (!cycle) throw new Error("회차가 없습니다.")
  const data = await loadScoreData(cycle)
  const confirmed = await loadFinalResults(cycle.id, data.people)
  return { cycle, people: data.people, data, live: scoreResultsOf(data), confirmed }
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

export function useReportSource(): ReportSource {
  const fakeReport = useReportState()
  const fakeScores = useScoreState()
  const [mode, setMode] = useState<"checking" | "fake" | "server">("checking")
  const [server, setServer] = useState<ServerState | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setServer(await loadServer())
      setError(null)
    } catch (caught) {
      setError(messageOf(caught))
    }
  }, [])

  useEffect(() => {
    let active = true
    void isAdminSession().then((isAdmin) => {
      if (!active) return
      setMode(isAdmin ? "server" : "fake")
      if (isAdmin) void reload()
    })
    return () => {
      active = false
    }
  }, [reload])

  if (mode === "fake") {
    return {
      status: "ready",
      error: null,
      round: reportSetting.round,
      published: fakeReport.resultPublished,
      publishedAt: fakeReport.publishedAt,
      liveResults: scoreResults(fakeScores),
      confirmed: fakeReport.confirmed,
      personByNo: fakePersonByNo,
      departmentKpi: fakeScores.departmentKpi,
      mix: fakeScores.mix,
      givenUpward: () => null,
      opinions: () => null,
      confirm: async () => (confirmResults(scoreResults(fakeScores)) ? null : "처리하지 못했습니다."),
      cancel: async () => (cancelConfirm() ? null : "처리하지 못했습니다."),
    }
  }

  return {
    status: error ? "error" : server ? "ready" : "loading",
    error,
    round: server?.cycle.id ?? reportSetting.round,
    published: server?.cycle.resultPublished ?? false,
    publishedAt: server?.cycle.publishedAt ?? null,
    liveResults: server?.live ?? [],
    confirmed: server?.confirmed ?? [],
    personByNo: new Map((server?.people ?? []).map((person) => [person.employeeNo, person])),
    departmentKpi: Object.fromEntries(
      (server?.data.departments ?? []).map((department) => [department.name, department.kpi ?? 0]),
    ),
    mix: server?.cycle.mix ?? fakeScores.mix,
    givenUpward: (employeeNo) => {
      if (!server) return null
      const nameOf = (no: string) => server.people.find((person) => person.employeeNo === no)?.name ?? no
      return givenUpwardScores(server.data.answerData, employeeNo).map((item) => ({
        targetName: nameOf(item.targetNo),
        stage: item.stage,
        score: item.score,
      }))
    },
    opinions: (employeeNo) =>
      server
        ? server.data.opinions
            .filter((item) => item.targetNo === employeeNo)
            .map(({ stage, opinion }) => ({ stage, opinion }))
        : null,
    // 확정하는 순간의 점수를 저장한다 (화면을 연 뒤 바뀐 점수가 있을 수 있어 다시 읽고 계산)
    confirm: async () => {
      try {
        const fresh = await loadServer()
        if (fresh.live.length === 0) return "확정할 결과가 없습니다."
        await publishResults(fresh.cycle.id, fresh.live, fresh.people)
        await reload()
        return null
      } catch (caught) {
        return messageOf(caught)
      }
    },
    cancel: async () => {
      if (!server) return "처리하지 못했습니다."
      try {
        await unpublishResults(server.cycle.id)
        await reload()
        return null
      } catch (caught) {
        return messageOf(caught)
      }
    },
  }
}
