import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function DesignQuestions() {
  return (
    <PagePlaceholder
      page={detailPages["평가 설계"]}
      initialSection="문항 편집"
    />
  )
}

export default DesignQuestions
