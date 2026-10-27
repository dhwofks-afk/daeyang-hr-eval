import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function ScoresResults() {
  return (
    <PagePlaceholder
      page={detailPages["점수·보정"]}
      initialSection="평가 결과"
    />
  )
}

export default ScoresResults
