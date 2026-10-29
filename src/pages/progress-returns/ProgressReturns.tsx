import { Undo2 } from "lucide-react"
import PagePlaceholder from "@/layout/PagePlaceholder"

// 진행 관리 > 제출 반려 (빈 페이지 틀). 담당자가 요구사항 문서에 따라 채운다.
function ProgressReturns() {
  return (
    <PagePlaceholder
      page={{
        area: "관리자 영역",
        title: "제출 반려",
        description: "제출된 평가를 되돌려 평가자가 다시 작성하게 합니다.",
        icon: Undo2,
        cards: [],
      }}
    />
  )
}

export default ProgressReturns
