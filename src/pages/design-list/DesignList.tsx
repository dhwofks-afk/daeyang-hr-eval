import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function DesignList() {
  return (
    <PagePlaceholder
      page={detailPages["평가 설계"]}
      initialSection="평가 목록"
    />
  )
}

export default DesignList
