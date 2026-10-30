import DesignQuestionsEditor from "@/pages/design-questions/DesignQuestionsEditor"

// 팀원 평가표 문항 편집 (생산직·관리직은 화면 안에서 고른다)
function DesignQuestionsMember() {
  return <DesignQuestionsEditor sheetKey="member" />
}

export default DesignQuestionsMember
