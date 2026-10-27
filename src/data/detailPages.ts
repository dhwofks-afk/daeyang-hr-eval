import {
  BarChart3,
  ClipboardCheck,
  Database,
  FileBarChart,
  FilePenLine,
  Gauge,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react"
import { type DetailPage } from "@/layout/PagePlaceholder"

// 빈 페이지 틀에 보일 내용. 키는 페이지 주소다.
// cards는 시안의 기능 설명 카드로, 페이지 담당자 참고용이다.
// "참고:"로 시작하는 항목은 주소가 따로 없는 참여자 화면의 참고 자료다.
export const detailPages: Record<string, DetailPage> = {
  "참고: 내 할 일": {
    area: "참여자 영역",
    title: "내 할 일",
    description: "해야 할 평가 목록과 상태, 진행률, 마감일을 확인합니다.",
    icon: ClipboardCheck,
    cards: [
      {
        label: "할 일 목록",
        details: ["상태: 미시작·진행 중·제출 완료", "진행률", "마감일"],
      },
    ],
  },
  "참고: 평가 작성": {
    area: "참여자 영역",
    title: "평가 작성",
    description: "평가 대상을 선택하고 평가를 작성해 제출합니다.",
    icon: FilePenLine,
    cards: [
      {
        label: "평가 대상 목록",
        details: ["임원은 배정된 팀원·팀장을 한 명씩 평가"],
      },
      {
        label: "평가 입력·제출",
        details: [
          "객관식·서술형",
          "임시저장·진행률",
          "중복 응답 차단",
          "제출 후 잠금 및 재열람 불가",
          "평가 의견 한 줄 이상 필수",
          "전 단계 완료 여부 표시",
        ],
      },
    ],
  },
  "참고: 내 설정": {
    area: "참여자 영역",
    title: "내 설정",
    description: "화면 언어를 관리합니다.",
    icon: Settings,
    cards: [{ label: "언어 선택", details: ["번역 언어 선택 (준비 중)"] }],
  },
  "참고: 내 결과": {
    area: "참여자 영역",
    title: "내 결과",
    description: "공개된 평가 결과를 확인하고 파일로 내보냅니다.",
    icon: FileBarChart,
    cards: [
      {
        label: "결과 열람·내보내기",
        details: [
          "PDF 내보내기",
          "Excel 내보내기",
          '관리자가 "결과 공개"한 뒤 열람',
          "공개 범위 안의 항목만 보임",
        ],
      },
    ],
  },

  "/admin/people/org-chart": {
    area: "관리자 영역",
    title: "조직도",
    description: "부서와 직급을 관리합니다.",
    icon: UsersRound,
    cards: [
      {
        label: "조직도",
        details: [
          "부서 관리",
          "직급 관리",
          "명단은 데이터 관리에서 업로드",
          "삭제 대신 퇴사 처리",
          "평가 중 수정 잠금",
        ],
      },
    ],
  },
  "/admin/people/relations": {
    area: "관리자 영역",
    title: "평가 관계",
    description: "부서별로 누가 누구를 평가하는지 설정합니다.",
    icon: UsersRound,
    cards: [
      {
        label: "평가 관계",
        details: [
          "부서별 평가자–대상 설정·수정",
          "시각화 방식은 페이지 단계에서 결정",
        ],
      },
    ],
  },
  "/admin/design/list": {
    area: "관리자 영역",
    title: "평가 목록",
    description: "평가를 만들고 시작일과 마감일을 관리합니다.",
    icon: FilePenLine,
    cards: [
      {
        label: "평가 목록",
        details: [
          "카드형",
          "평가 전·평가 중·평가 완료",
          '평가 전: "평가 시작" (시작일·마감일)',
          '평가 중: "마감일 수정"',
        ],
      },
      {
        label: "가중치",
        details: [
          "팀원용(3단계)·팀장용(2단계) 따로 설정",
          "기본값 회사 확인 중",
        ],
      },
      {
        label: "평가 시작",
        details: [
          "문항·대상자·평가자·관계·조직도 잠금",
          "마감일은 수정 가능",
        ],
      },
    ],
  },
  "/admin/design/questions": {
    area: "관리자 영역",
    title: "문항 편집",
    description: "평가별 문항을 편집합니다.",
    icon: FilePenLine,
    showPreview: true,
    cards: [
      {
        label: "문항 편집",
        details: [
          "웹 편집",
          "엑셀 업로드",
          "순서 수정",
          "카드 3개 (자기평가·팀원평가·팀장평가)",
          "우측 상단 미리보기",
        ],
      },
    ],
  },
  "/admin/design/questions/self": {
    area: "관리자 영역",
    title: "자기평가 문항",
    description: "자기평가 문항을 편집합니다.",
    icon: FilePenLine,
    showPreview: true,
    cards: [
      {
        label: "문항 편집",
        details: ["웹 편집", "엑셀 업로드", "순서 수정", "우측 상단 미리보기"],
      },
    ],
  },
  "/admin/design/questions/member": {
    area: "관리자 영역",
    title: "팀원평가 문항",
    description: "팀원평가 문항을 편집합니다.",
    icon: FilePenLine,
    showPreview: true,
    cards: [
      {
        label: "문항 편집",
        details: ["웹 편집", "엑셀 업로드", "순서 수정", "우측 상단 미리보기"],
      },
    ],
  },
  "/admin/design/questions/leader": {
    area: "관리자 영역",
    title: "팀장평가 문항",
    description: "팀장평가 문항을 편집합니다.",
    icon: FilePenLine,
    showPreview: true,
    cards: [
      {
        label: "문항 편집",
        details: ["웹 편집", "엑셀 업로드", "순서 수정", "우측 상단 미리보기"],
      },
    ],
  },
  "/admin/progress": {
    area: "관리자 영역",
    title: "진행 관리",
    description: "사람별 응답 상태와 제출 이후의 운영 업무를 관리합니다.",
    icon: Gauge,
    cards: [
      {
        label: "응답 현황",
        details: ["사람별 상태", "진행률", "미완료자 현황"],
      },
      {
        label: "안내·독촉",
        details: ["카카오톡 챗봇 검토, 불가 시 생략"],
        status: "차후 연결",
      },
      {
        label: "제출 반려",
        details: ["제출 상태를 되돌려 다시 작성", "필터·검색"],
      },
    ],
  },
  "/admin/scores/results": {
    area: "관리자 영역",
    title: "평가 결과",
    description: "단계별 점수와 최종 점수를 확인합니다.",
    icon: BarChart3,
    cards: [
      {
        label: "평가 결과",
        details: ["단계별 점수", "가중 합산 최종 점수"],
      },
    ],
  },
  "/admin/scores/kpi": {
    area: "관리자 영역",
    title: "KPI 반영",
    description: "부서 KPI 점수를 입력해 평가 결과에 반영합니다.",
    icon: BarChart3,
    cards: [
      {
        label: "KPI 반영",
        details: [
          "부서 KPI 점수(100점 기준) 입력",
          "원점수 vs 반영 점수 비교",
          "반영 산식 회사 확인 중",
        ],
      },
    ],
  },
  "/admin/scores/adjust": {
    area: "관리자 영역",
    title: "최종 점수 보정",
    description: "최종 점수에 보정 값을 직접 입력합니다.",
    icon: BarChart3,
    cards: [
      {
        label: "최종 점수 보정",
        details: [
          "숫자 직접 입력, 생략 가능",
          "모든 보정 로그 기록",
          "한 페이지에서 전·후 비교",
        ],
      },
    ],
  },
  "/admin/reports": {
    area: "관리자 영역",
    title: "리포트",
    description: "평가 결과를 용도별 리포트로 정리합니다.",
    icon: FileBarChart,
    cards: [
      {
        label: "요약 리포트",
        details: ["항목별·전체 선택 체크리스트", "회사 전체 대상"],
      },
      {
        label: "개인 리포트",
        details: [
          "직원 공개",
          "공개 범위 체크리스트 (전 직원 일괄)",
          '"결과 공개" 버튼',
          "공개 후 수정 제한 방식은 페이지 단계에서 결정",
        ],
      },
      {
        label: "면담 리포트",
        details: ["직원별", "인사팀장만 열람"],
      },
    ],
  },
  "/admin/interview": {
    area: "관리자 영역",
    title: "면담 지원 AX",
    description: "평가 결과를 바탕으로 면담을 지원합니다.",
    icon: Sparkles,
    cards: [
      {
        label: "면담 지원",
        details: [
          "면담용 인사이트 정리",
          "면담 질문 추천",
          "인사팀장 열람",
          "구현 범위 추가 논의 예정",
        ],
        status: "보류",
      },
    ],
  },
  "/admin/data": {
    area: "관리자 영역",
    title: "데이터 관리",
    description:
      "직원 명단을 올리고, 평가 데이터를 내려받고, 연초에 시스템 데이터를 초기화합니다.",
    icon: Database,
    cards: [
      {
        label: "직원 명단 업로드",
        details: ["직원 명단 엑셀 업로드"],
      },
      {
        label: "엑셀 내보내기",
        details: ["개인별 내보내기", "전체 내보내기"],
      },
      {
        label: "데이터 초기화",
        details: [
          "데이터 내려받기",
          "시스템 데이터 초기화",
          "연초 순서: 내려받기 → 초기화 → 새 명단 업로드",
        ],
      },
    ],
  },
}
