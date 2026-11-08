-- 01_departments_cycle.sql : 본부 3개, 부서 6개, 회차 1개 (src/data/scores.ts 설정값 그대로)
-- 실행: migrations 001~018 다음, SQL Editor에서 seed 01 → 05 순서로 한 번씩 실행한다.
-- (지금 운영 중인 프로젝트는 이미 들어가 있으므로 다시 실행하지 않는다. 새 프로젝트를 세울 때만)

insert into headquarters (id, name, sort_order) values
  (1, '기술영업본부', 1), (2, '생산기술본부', 2), (3, '구매자재본부', 3)
on conflict (id) do nothing;

-- 부서 6개 (경영기획부·안전품질부는 본부 없음). 시연 직원은 1~3번 부서에만 있다
insert into departments (id, name, kpi, headquarters_id) values
  (1, '경영기획부', 85, null),
  (2, '기술영업부', 76, 1),
  (3, '생산부',     82, 2),
  (4, '기술부',     78, 2),
  (5, '구매자재부', 80, 3),
  (6, '안전품질부', 83, null);

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

-- 회차 1의 부서 KPI (016 cycle_kpis). 새 프로젝트는 016이 seed보다 먼저 실행되어 비어 있으므로 여기서 넣는다
insert into cycle_kpis (cycle_id, department_id, kpi)
select 1, id, kpi from departments
on conflict (cycle_id, department_id) do nothing;
