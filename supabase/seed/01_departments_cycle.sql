-- 01_departments_cycle.sql : 부서 3개, 회차 1개 (src/data/scores.ts 설정값 그대로)
-- 실행: migrations 001~003 다음, SQL Editor에서 seed 01 → 05 순서로 한 번씩 실행한다.

insert into departments (id, name, kpi) values
  (1, '경영기획부', 85),
  (2, '영업부',     76),   -- KPI 기준값(80) 미달 → 감점 장면
  (3, '생산',       82);

insert into cycles (
  id, name, status, start_date, deadline,
  weight_member_self, weight_member_leader, weight_member_executive,
  weight_leader_self, weight_leader_executive, weight_leader_upward,
  kpi_method, kpi_base, kpi_factor,
  grade_a, grade_b, grade_c, grade_d,
  result_published, published_at, public_scope
) values (
  1, '정기 인사평가', 'in_progress', null, null,   -- 시작일·마감일 미정
  20, 40, 40,        -- 팀원: 자기 20 / 팀장 40 / 임원 40
  20, 80, 20,        -- 팀장: 자기 20 / 임원 80, 상향 반영 20 (상향 비율은 회사 확인 예정)
  'add', 80, 0.2,    -- KPI 가산, 기준 80, 계수 0.2
  25, 25, 35, 15,    -- 등급 비율 A / B / C / D
  false, null, '{}'  -- 결과 미공개, 공개 범위 전부 미공개
);
