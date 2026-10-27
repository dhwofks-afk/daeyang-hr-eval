import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function ScoresAdjust() {
  return (
    <PagePlaceholder
      page={detailPages["점수·보정"]}
      initialSection="최종 점수 보정"
    />
  )
}

export default ScoresAdjust
