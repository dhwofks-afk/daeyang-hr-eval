import PagePlaceholder from "@/layout/PagePlaceholder"
import { detailPages } from "@/data/detailPages"

function PeopleRelations() {
  return (
    <PagePlaceholder
      page={detailPages["사람·조직"]}
      initialSection="평가 관계"
    />
  )
}

export default PeopleRelations
