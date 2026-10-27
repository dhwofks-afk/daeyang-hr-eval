import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function ScoresKpi() {
  return (
    <PagePlaceholder
      page={detailPages["점수·보정"]}
      initialSection="부서 KPI 입력 반영"
    />
  )
}

export default ScoresKpi
