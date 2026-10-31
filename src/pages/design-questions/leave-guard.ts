// 저장하지 않은 수정이 있을 때 페이지를 나가려 하면 먼저 물어본다 (문항 편집 [완료] 전).
// 주소 목록·사이드바는 공통 파일이라 고치지 않고, 이 화면에서 브라우저 동작을 잠깐 가로챈다.
// - 사이드바 메뉴·로그아웃: 누르기 직전에 가로채 확인 창을 띄우고, 확인하면 원래 버튼을 다시 누른다
// - 뒤로 가기: 지금 주소를 한 칸 더 쌓아 두었다가, 그 칸이 빠지면 다시 쌓고 확인 창을 띄운다
// - 새로고침·창 닫기: 브라우저 기본 확인 창 (문구는 브라우저가 정해서 바꿀 수 없다)
import { useEffect, useRef } from "react"

// ask(leave): 확인 창을 띄우고, 사용자가 [확인]을 누르면 leave()를 부른다
export function useLeaveGuard(dirty: boolean, ask: (leave: () => void) => void) {
  const askRef = useRef(ask)
  askRef.current = ask
  // 뒤로 가기용으로 쌓아 둔 칸이 아직 맨 위에 있는지
  const guardOnTop = useRef(false)

  useEffect(() => {
    if (!dirty) return

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }

    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element | null)?.closest<HTMLElement>(
        ".sidebar-nav button:not([aria-expanded]), .logout-button",
      )
      if (!button || button.dataset.leaveConfirmed) return
      event.preventDefault()
      event.stopPropagation()
      askRef.current(() => {
        button.dataset.leaveConfirmed = "true"
        button.click()
        delete button.dataset.leaveConfirmed
      })
    }

    window.history.pushState(window.history.state, "", window.location.href)
    guardOnTop.current = true
    const onPopState = () => {
      if (!guardOnTop.current) return
      // 쌓아 둔 칸이 빠졌다: 다시 쌓아 두고 물어본다. 확인하면 쌓아 둔 칸과 지금 칸을 건너 이전 페이지로
      window.history.pushState(window.history.state, "", window.location.href)
      askRef.current(() => {
        guardOnTop.current = false
        window.history.go(-2)
      })
    }

    window.addEventListener("beforeunload", onBeforeUnload)
    document.addEventListener("click", onClick, true)
    window.addEventListener("popstate", onPopState)
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload)
      document.removeEventListener("click", onClick, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [dirty])

  // [완료]로 저장할 때: 뒤로 가기용으로 쌓아 둔 칸을 빼서 기록을 원래대로 둔다
  const release = () => {
    if (!guardOnTop.current) return
    guardOnTop.current = false
    window.history.back()
  }

  // 탭을 바꾸며 수정을 버릴 때: 쌓아 둔 칸은 새 탭 주소로 바꿔 쓰므로 빼지 않는다
  const forget = () => {
    guardOnTop.current = false
  }

  return { release, forget }
}
