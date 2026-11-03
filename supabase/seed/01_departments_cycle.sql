-- 01_departments_cycle.sql : 부서 3개, 회차 1개 (src/data/scores.ts 설정값 그대로)
-- 실행: migrations 001~010 다음, SQL Editor에서 seed 01 → 05 순서로 한 번씩 실행한다.
-- (지금 운영 중인 프로젝트는 이미 들어가 있으므로 다시 실행하지 않는다. 새 프로젝트를 세울 때만)

insert into departments (id, name, kpi) values
  (1, '경영기획부', 85),
  (2, '영업부',     76),
  (3, '생산',       82);

insert into cycles (
  id, name, status, start_date, deadline,
  weight_member_self, weight_member_leader, weight_member_executive,
  weight_leader_self, weight_leader_executive,
  mix_member_personal, mix_member_kpi,
  mix_leader_personal, mix_leader_kpi, mix_leader_upward,
  result_published, published_at
) values (
  1, '정기 인사평가', 'in_progress', null, null,   -- 시작일·마감일 미정
  20, 40, 40,        -- 개인 평가 (팀원): 자기 20 / 팀장 40 / 임원 40
  20, 80,            -- 개인 평가 (팀장): 자기 20 / 임원 80
  80, 20,            -- 최종 (팀원): 개인 평가 80 / 부서 KPI 20
  30, 30, 40,        -- 최종 (팀장): 개인 평가 30 / 부서 KPI 30 / 상향 평가 40 (차장님 답변 11/2)
  false, null        -- 결과 확정 전
);
