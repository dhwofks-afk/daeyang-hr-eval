import DesignQuestionsEditor from "@/pages/design-questions/DesignQuestionsEditor"

// 상향 평가표 문항 편집.
// 주소가 평가표 기준(.../upward)으로 바뀌기 전까지 임시로 이 주소(.../self)를 쓴다.
function DesignQuestionsSelf() {
  return <DesignQuestionsEditor sheetKey="upward" />
}

export default DesignQuestionsSelf
