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

export const detailPages: Record<string, DetailPage> = {
  "내 할 일": {
    area: "참여자 영역",
    title: "내 할 일",
    description: "해야 할 평가 목록과 상태, 진행률, 마감일을 확인합니다.",
    icon: ClipboardCheck,
    sections: [
      {
        label: "할 일 목록",
        details: ["상태: 미시작·진행 중·제출 완료", "진행률", "마감일"],
      },
    ],
  },
  "평가 작성": {
    area: "참여자 영역",
    title: "평가 작성",
    description: "평가 대상을 선택하고 평가를 작성해 제출합니다.",
    icon: FilePenLine,
    sections: [
      {
        label: "평가 대상 목록",
        details: [
          "팀장·임원 평가 대상 선택",
          "임원 평가 범위는 회사 확인 필요",
        ],
      },
      {
        label: "평가 입력·제출",
        details: [
          "객관식·서술형",
          "임시저장·진행률",
          "중복 응답 차단",
          "제출 후 잠금 및 재열람 불가",
        ],
      },
    ],
  },
  "내 설정": {
    area: "참여자 영역",
    title: "내 설정",
    description: "개인 계정과 화면 언어를 관리합니다.",
    icon: Settings,
    sections: [
      {
        label: "비밀번호 변경",
        details: ["첫 로그인 시 비밀번호 변경", "개인 비밀번호 변경"],
      },
      { label: "언어 선택", details: ["번역 언어 선택"] },
    ],
  },
  "내 결과": {
    area: "참여자 영역",
    title: "내 결과",
    description: "평가 결과를 필요한 파일 형식으로 내보냅니다.",
    icon: FileBarChart,
    sections: [
      {
        label: "PDF 내보내기",
        details: ["PDF 내보내기"],
      },
      {
        label: "Excel 내보내기",
        details: ["Excel 내보내기"],
      },
    ],
  },
  사람·조직: {
    area: "관리자 영역",
    title: "사람·조직",
    description: "직원, 조직, 계정과 평가 관계를 관리합니다.",
    icon: UsersRound,
    sections: [
      {
        label: "직원 목록",
        details: ["직원 추가·수정·삭제"],
      },
      { label: "조직도", details: ["부서 관리", "직급 관리"] },
      {
        label: "계정 관리",
        details: [
          "초기 비밀번호 발급·재발급",
          "사람당 개인 링크 1개 발급",
          "링크 만료 방식 미정",
        ],
      },
      {
        label: "평가 관계",
        details: [
          "누가 누구를 평가하는지",
          "부서 소속을 기반으로 자동 생성   ",
          "관리자 수정 가능",
        ],
      },
    ],
  },
  "평가 설계": {
    area: "관리자 영역",
    title: "평가 설계",
    description: "평가 유형, 단계, 가중치, 마감일과 문항을 설정합니다.",
    icon: FilePenLine,
    sections: [
      {
        label: "평가 목록",
        details: ["설정 중·진행 중·종료 상태"],
      },
      {
        label: "평가 설계",
        details: [
          "가중치 설정",
          "평가 유형 설정",
          "마감일 선택",
        ],
      },
      {
        label: "문항 편집",
        details: [
          "평가별 웹에서 하나씩 편집",
          "엑셀 일괄 업로드",
          "문항 순서·구성 수정",
        ],
      },
      {
        label: "평가 시작",
        details: ["시작하면 문항·대상자·평가자·평가 관계 잠금"],
      },
    ],
  },
  "진행 관리": {
    area: "관리자 영역",
    title: "진행 관리",
    description: "사람별 응답 상태와 제출 이후의 운영 업무를 관리합니다.",
    icon: Gauge,
    sections: [
      {
        label: "응답 현황",
        details: ["사람별 상태", "진행률", "미완료자 현황"],
      },
      {
        label: "안내·독촉",
        details: ["시작 안내", "마감일 기준 알림", "미완료자 독촉"],
        status: "차후 연결",
      },
      {
        label: "제출 반려",
        details: ["제출 상태를 되돌려 다시 작성"],
      },
    ],
  },
  점수·보정: {
    area: "관리자 영역",
    title: "점수·보정",
    description: "단계별 점수와 최종 점수를 계산하고 보정합니다.",
    icon: BarChart3,
    sections: [
      {
        label: "평가 결과",
        details: ["단계별 점수", "가중 합산 최종 점수"],
      },
      {
        label: "최종 점수 보정",
        details: [
          "계산된 최종 점수에 가감",
          "보정 값만 기록",
          "가감 형태 미정",
        ],
      },
      {
        label: "부서 KPI 입력 반영",
        details: ["KPI 산식과 부서별 평가 항목 자료 필요"],
        status: "자료 대기",
      },
    ],
  },
  리포트: {
    area: "관리자 영역",
    title: "리포트",
    description: "평가 결과를 용도별 리포트로 정리합니다.",
    icon: FileBarChart,
    sections: [
      {
        label: "요약 리포트",
        details: ["요약 리포트에 들어갈 자료 체크리스트"],
      },
      {
        label: "개인 리포트",
        details: [
          "개인 리포트에 들어갈 자료 체크리스트",
          "직원 공개 여부·범위 미정",
        ],
        status: "보류",
      },
      {
        label: "면담 리포트",
        details: ["면담 리포트에 들어갈 자료 체크리스트"],
      },
    ],
  },
  "면담 지원 AX": {
    area: "관리자 영역",
    title: "면담 지원 AX",
    description: "평가 결과를 바탕으로 면담을 지원합니다.",
    icon: Sparkles,
    sections: [
      {
        label: "면담 지원",
        details: ["면담용 인사이트 정리", "면담 질문 추천", "인사팀장 열람"],
      },
    ],
  },
  "데이터 관리": {
    area: "관리자 영역",
    title: "데이터 관리",
    description: "평가 데이터를 내려받고 연초 시스템 데이터를 초기화합니다.",
    icon: Database,
    sections: [
      {
        label: "엑셀 내보내기",
        details: ["개인별 내보내기", "전체 내보내기"],
      },
      {
        label: "데이터 초기화",
        details: ["데이터 내려받기", "시스템 데이터 초기화"],
      },
    ],
  },
}
