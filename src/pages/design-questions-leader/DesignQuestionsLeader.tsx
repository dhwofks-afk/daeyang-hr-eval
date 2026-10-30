import DesignQuestionsEditor from "@/pages/design-questions/DesignQuestionsEditor"

// 팀장 평가표 문항 편집 (생산직·관리직은 화면 안에서 고른다)
function DesignQuestionsLeader() {
  return <DesignQuestionsEditor sheetKey="leader" />
}

export default DesignQuestionsLeader
