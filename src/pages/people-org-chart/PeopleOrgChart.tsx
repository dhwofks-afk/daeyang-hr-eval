import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function PeopleOrgChart() {
  return (
    <PagePlaceholder
      page={detailPages["사람·조직"]}
      initialSection="조직도"
    />
  )
}

export default PeopleOrgChart
