// 가짜 직원 명단. 사람은 사원번호로 구분하고, 이름은 화면 표시에만 쓴다.
// 부서·인원: 경영기획부 3명 / 영업부 6명 / 생산 18명 (총 27명) + 임원 부서마다 1명 (3명, 11/3부터 평가 대상).

// 회사 직급 체계 (낮은 직급 → 높은 직급). 바뀔 수 있으므로 여기서만 관리한다.
// "팀장"은 직급이 아니라 역할(role)이다.
export const positions = [
  "사원",
  "주임",
  "대리",
  "과장",
  "차장",
  "부장",
  "이사",
  "상무",
  "부사장",
  "회장",
]

export type PersonRole = "member" | "leader" | "executive"

export type Person = {
  employeeNo: string
  name: string
  department: string
  position: string
  role: PersonRole
}

export const people: Person[] = [
  // 경영기획부 (3명)
  { employeeNo: "900001", name: "최정민", department: "경영기획부", position: "부장", role: "leader" },
  { employeeNo: "900002", name: "이수아", department: "경영기획부", position: "대리", role: "member" },
  { employeeNo: "900003", name: "장도윤", department: "경영기획부", position: "사원", role: "member" },

  // 영업부 (6명)
  { employeeNo: "900004", name: "한지훈", department: "영업부", position: "차장", role: "leader" },
  { employeeNo: "900005", name: "강수빈", department: "영업부", position: "사원", role: "member" },
  { employeeNo: "900006", name: "서예린", department: "영업부", position: "주임", role: "member" },
  { employeeNo: "900007", name: "문현우", department: "영업부", position: "과장", role: "member" },
  { employeeNo: "900008", name: "임채원", department: "영업부", position: "대리", role: "member" },
  { employeeNo: "900009", name: "노지환", department: "영업부", position: "사원", role: "member" },

  // 생산 (18명)
  { employeeNo: "900010", name: "박서준", department: "생산", position: "과장", role: "leader" },
  { employeeNo: "900011", name: "김민수", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900012", name: "최유진", department: "생산", position: "대리", role: "member" },
  { employeeNo: "900013", name: "정다은", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900014", name: "오승현", department: "생산", position: "과장", role: "member" },
  { employeeNo: "900015", name: "윤태호", department: "생산", position: "과장", role: "member" },
  { employeeNo: "900016", name: "송지아", department: "생산", position: "대리", role: "member" },
  { employeeNo: "900017", name: "권태양", department: "생산", position: "주임", role: "member" },
  { employeeNo: "900018", name: "배하늘", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900019", name: "신동현", department: "생산", position: "주임", role: "member" },
  { employeeNo: "900020", name: "유가은", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900021", name: "조민재", department: "생산", position: "대리", role: "member" },
  { employeeNo: "900022", name: "황보람", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900023", name: "안성훈", department: "생산", position: "차장", role: "member" },
  { employeeNo: "900024", name: "전소윤", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900025", name: "홍재원", department: "생산", position: "주임", role: "member" },
  { employeeNo: "900026", name: "고은비", department: "생산", position: "사원", role: "member" },
  { employeeNo: "900027", name: "남궁현", department: "생산", position: "사원", role: "member" },

  // 임원 (부서마다 1명, 각자 소속 부서. 같은 부서 팀원·팀장이 임원 상향 평가를 한다)
  { employeeNo: "900028", name: "이정호", department: "생산", position: "상무", role: "executive" },
  { employeeNo: "900029", name: "윤재석", department: "경영기획부", position: "이사", role: "executive" },
  { employeeNo: "900030", name: "백승민", department: "영업부", position: "이사", role: "executive" },
]

export const findPerson = (employeeNo: string) =>
  people.find((person) => person.employeeNo === employeeNo)
