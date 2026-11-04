import { useEffect, useState, useSyncExternalStore } from "react"
import {
  chooseCycle,
  cycleStatusNames,
  getChosenCycleId,
  isAdminSession,
  loadCycles,
  subscribeChosenCycle,
  type AdminCycle,
} from "@/lib/admin-data"

// 관리자 상단바의 평가 선택 상자 (016). 고른 평가는 대시보드·진행 관리·점수·리포트 등이 함께 본다.
// 기본값: 평가 중인 평가, 없으면 가장 최근 평가. 실제 관리자 로그인일 때만 보인다 (역할 미리보기는 숨김)
export const useChosenCycleId = () => useSyncExternalStore(subscribeChosenCycle, getChosenCycleId)

function CycleSelect() {
  const chosen = useChosenCycleId()
  const [cycles, setCycles] = useState<AdminCycle[] | null>(null)

  // 페이지를 옮길 때마다 다시 읽는다 (평가 목록에서 추가·삭제한 평가가 바로 보이게)
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (!(await isAdminSession())) return
      try {
        const list = await loadCycles()
        if (alive) setCycles(list)
      } catch {
        // 못 읽으면 상자를 보이지 않는다 (각 페이지가 오류를 보여 준다)
      }
    })()
    return () => {
      alive = false
    }
  }, [chosen])

  if (!cycles?.length) return null
  const fallback = cycles.find((cycle) => cycle.status === "in_progress") ?? cycles[0]
  const value = cycles.find((cycle) => cycle.id === chosen)?.id ?? fallback.id

  return (
    <label className="cycle-select">
      <span>평가</span>
      <select value={value} onChange={(event) => chooseCycle(Number(event.target.value))}>
        {cycles.map((cycle) => (
          <option key={cycle.id} value={cycle.id}>
            {`${cycle.name} (${cycleStatusNames[cycle.status]})`}
          </option>
        ))}
      </select>
    </label>
  )
}

export default CycleSelect
