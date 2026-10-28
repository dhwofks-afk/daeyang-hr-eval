-- 001_tables.sql : 표 8개 만들기 (docs/10-데이터설계.md)
--
-- 실행 방법: Supabase 웹 → SQL Editor에 이 파일 전체를 붙여 넣고 Run.
--           새 프로젝트에서 한 번만 실행한다. (웹 Table Editor에서 표를 직접 만들거나 고치지 않는다)
-- 이름 규칙: 표·칸 이름은 영어, 옆에 한글 설명. 목록 값도 영어 코드로 저장하고 아래 주석에 뜻을 적는다.
-- 사번은 비밀번호 역할이라 직원 표에만 둔다. 다른 표는 직원의 내부 번호(employees.id)로 연결한다.
-- 모든 표는 만들자마자 잠근다(RLS). 여는 규칙은 002_policies.sql에 있다.


-- ---------------------------------------------------------------
-- 2. departments (부서)
-- ---------------------------------------------------------------
create table departments (
  id   integer primary key,                         -- 부서 번호
  name text not null unique,                        -- 부서명
  kpi  numeric(5, 1) check (kpi between 0 and 100)  -- KPI 점수 (0~100, 아직 없으면 비움)
);
comment on table departments is '부서';


-- ---------------------------------------------------------------
-- 1. employees (직원)
-- ---------------------------------------------------------------
create table employees (
  id            integer generated always as identity primary key,  -- 내부 번호 (다른 표가 연결할 때 씀)
  employee_no   text not null unique
                  check (employee_no ~ '^[0-9]+$'),                -- 사번 (관리자만 읽음)
  name          text not null,                                     -- 이름 (화면 표시용)
  department_id integer not null references departments (id),      -- 부서
  position      text not null,                                     -- 직급 (사원~회장. 목록이 바뀔 수 있어 고정하지 않음)
  role          text not null
                  check (role in ('member', 'leader', 'executive')), -- 역할: member 팀원 / leader 팀장 / executive 임원
  job_group     text not null
                  check (job_group in ('production', 'office')),   -- 직군: production 생산직 / office 관리직. 문항 세트를 정함
  excluded      boolean not null default false,                    -- 평가 제외 (6개월 미만 등)
  status        text not null default 'active'
                  check (status in ('active', 'retired')),         -- 재직 상태: active 재직 / retired 퇴사 (삭제 대신 퇴사 처리)
  auth_user_id  uuid unique
                  references auth.users (id) on delete set null    -- 로그인 계정 (계정 만들기 스크립트가 채움)
);
comment on table employees is '직원';


-- ---------------------------------------------------------------
-- 3. cycles (평가 설정 = 회차)
-- ---------------------------------------------------------------
create table cycles (
  id                     integer primary key,                     -- 회차 번호
  name                   text not null,                           -- 이름
  status                 text not null default 'before'
                           check (status in ('before', 'in_progress', 'done')),  -- 상태: before 평가 전 / in_progress 평가 중 / done 평가 완료
  start_date             date,                                    -- 시작일 (미정이면 비움)
  deadline               date,                                    -- 마감일 (미정이면 비움)

  -- 가중치 (팀원): 자기 / 팀장 / 임원, 합 100
  weight_member_self      numeric(5, 2) not null,
  weight_member_leader    numeric(5, 2) not null,
  weight_member_executive numeric(5, 2) not null,
  -- 가중치 (팀장): 자기 / 임원 (합 100), 상향 반영 비율
  weight_leader_self      numeric(5, 2) not null,
  weight_leader_executive numeric(5, 2) not null,
  weight_leader_upward    numeric(5, 2) not null,

  kpi_method             text not null
                           check (kpi_method in ('add', 'multiply')),  -- KPI 방식: add 가산 / multiply 배율
  kpi_base               numeric(5, 1) not null,                  -- KPI 기준값
  kpi_factor             numeric(6, 3) not null,                  -- KPI 계수

  -- 등급 비율 (A / B / C / D, 합 100)
  grade_a                numeric(5, 2) not null,
  grade_b                numeric(5, 2) not null,
  grade_c                numeric(5, 2) not null,
  grade_d                numeric(5, 2) not null,

  result_published       boolean not null default false,          -- 결과 공개
  published_at           timestamptz,                             -- 공개 시각
  public_scope           text[] not null default '{}',            -- 공개 범위 (체크된 칸 이름 목록. 기본 전부 미공개)

  check (weight_member_self + weight_member_leader + weight_member_executive = 100),
  check (weight_leader_self + weight_leader_executive = 100),
  check (weight_leader_upward between 0 and 100),
  check (grade_a + grade_b + grade_c + grade_d = 100)
);
comment on table cycles is '평가 설정 (= 회차)';


-- ---------------------------------------------------------------
-- 4. questions (문항)
-- ---------------------------------------------------------------
create table questions (
  id            integer generated always as identity primary key,  -- 문항 번호
  cycle_id      integer not null references cycles (id),           -- 회차
  question_set  text not null
                  check (question_set in (
                    'office_member',      -- 관리직-팀원
                    'office_leader',      -- 관리직-팀장
                    'production_member',  -- 생산직-팀원
                    'production_leader',  -- 생산직-팀장
                    'upward'              -- 상향 (팀장평가표)
                  )),                                              -- 문항 세트
  field         text not null,                                     -- 분야
  factor        text not null,                                     -- 평정요소
  factor_points numeric(5, 1) not null check (factor_points > 0),  -- 평정요소 배점
  content       text not null,                                     -- 문구
  type          text not null check (type in ('choice', 'essay')), -- 유형: choice 객관식 / essay 서술형
  sort_order    integer not null                                   -- 순서
);
comment on table questions is '문항';
create index questions_set_idx on questions (cycle_id, question_set, sort_order);


-- ---------------------------------------------------------------
-- 5. cases (평가 건)
-- ---------------------------------------------------------------
create table cases (
  id           integer generated always as identity primary key,   -- 평가 건 번호
  cycle_id     integer not null references cycles (id),            -- 회차
  target_id    integer not null references employees (id),         -- 평가 대상 (직원 내부 번호)
  evaluator_id integer not null references employees (id),         -- 평가자 (직원 내부 번호)
  stage        text not null
                 check (stage in ('self', 'leader', 'executive', 'upward')),  -- 단계: self 자기 / leader 팀장 / executive 임원 / upward 상향
  status       text not null default 'not_started'
                 check (status in ('not_started', 'in_progress', 'submitted', 'returned')),  -- 상태: 작성 전 / 작성 중 / 제출 / 반려
  opinion      text,                                               -- 평가 의견 (제출할 때 필수)
  submitted_at timestamptz,                                        -- 제출 시각

  unique (cycle_id, target_id, evaluator_id, stage),
  check (status <> 'submitted' or (opinion is not null and length(trim(opinion)) > 0 and submitted_at is not null)),
  check ((stage = 'self') = (target_id = evaluator_id))            -- 자기평가만 대상 = 평가자
);
comment on table cases is '평가 건 (상향 평가의 평가자는 관리자만 볼 수 있다)';
create index cases_evaluator_idx on cases (evaluator_id);
create index cases_target_idx on cases (target_id);


-- ---------------------------------------------------------------
-- 6. answers (답)
-- ---------------------------------------------------------------
create table answers (
  case_id     integer not null references cases (id) on delete cascade,  -- 평가 건
  question_id integer not null references questions (id),                -- 문항
  score       numeric(5, 1) check (score >= 0),                          -- 점수: 객관식 1~5 / 서술형 0~배점
  essay       text,                                                      -- 서술 내용 (서술형만)
  updated_at  timestamptz not null default now(),
  primary key (case_id, question_id)
);
comment on table answers is '답';


-- ---------------------------------------------------------------
-- 7. final_results (확정 결과) — "결과 공개"를 누르는 순간의 결과
-- ---------------------------------------------------------------
create table final_results (
  cycle_id        integer not null references cycles (id),     -- 회차
  employee_id     integer not null references employees (id),  -- 직원 (내부 번호)
  department_name text not null,                               -- 부서 (그 당시)
  score_self      numeric(5, 1),                               -- 단계별 점수: 자기
  score_leader    numeric(5, 1),                               --             팀장
  score_executive numeric(5, 1),                               --             임원
  score_upward    numeric(5, 1),                               --             상향 (팀장만)
  weighted        numeric(5, 1) not null,                      -- 가중 합산 점수
  kpi_applied     numeric(5, 1) not null,                      -- KPI 반영 점수
  final           numeric(5, 1) not null,                      -- 보정 후 최종 점수
  grade           text not null check (grade in ('A', 'B', 'C', 'D')),  -- 등급
  published_at    timestamptz not null,                        -- 공개 시각
  primary key (cycle_id, employee_id)
);
comment on table final_results is '확정 결과';


-- ---------------------------------------------------------------
-- 8. adjustments (보정 기록) — 지우거나 고치지 않는다. 현재 보정값 = 그 직원의 가장 최근 기록
-- ---------------------------------------------------------------
create table adjustments (
  id           integer generated always as identity primary key,
  cycle_id     integer not null references cycles (id),          -- 회차
  employee_id  integer not null references employees (id),       -- 직원 (내부 번호)
  before_score numeric(5, 1) not null,                           -- 보정 전
  after_score  numeric(5, 1) not null
                 check (after_score between 0 and 100),          -- 보정 후
  reason       text,                                             -- 사유 (선택)
  adjusted_by  text not null,                                    -- 보정한 사람
  adjusted_at  timestamptz not null default now()                -- 보정 시각
);
comment on table adjustments is '보정 기록';
create index adjustments_employee_idx on adjustments (cycle_id, employee_id, adjusted_at);


-- ---------------------------------------------------------------
-- 모든 표 잠그기 (규칙이 없으면 아무도 못 읽고 못 씀. 여는 규칙은 002_policies.sql)
-- ---------------------------------------------------------------
alter table departments   enable row level security;
alter table employees     enable row level security;
alter table cycles        enable row level security;
alter table questions     enable row level security;
alter table cases         enable row level security;
alter table answers       enable row level security;
alter table final_results enable row level security;
alter table adjustments   enable row level security;
