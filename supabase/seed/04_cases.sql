-- 04_cases.sql : 평가 건 만들기 (docs/05-서버기반.md 3번 규칙). 회차 1.
-- 평가 대상: 재직(active) + 평가 제외 아님(excluded = false)인 팀원·팀장.
--           임원은 평가 제외라 대상이 아니고, 평가자 역할만 한다.
-- 평가자:   재직(active)인 사람. (평가 제외는 "평가받지 않음"이라 평가자로는 참여한다)
-- 임원 배정: 지금은 임원이 1명이라 재직 중인 임원 중 내부 번호가 가장 작은 사람이 모든 대상을 평가한다.
--           (부서별 평가 관계 설정 화면이 생기면 그 값으로 바꾼다)
-- 예상 건수: 팀원 24명 × 3건(자기·팀장·임원) = 72 + 팀장 3명 × 2건(자기·임원) = 6 + 상향 24건 = 102건

-- 1) 자기평가: 대상 모두 1건
insert into cases (cycle_id, target_id, evaluator_id, stage)
select 1, t.id, t.id, 'self'
from employees t
where t.role in ('member', 'leader') and t.status = 'active' and not t.excluded;

-- 2) 팀장 평가: 팀원마다 같은 부서 팀장 1건
insert into cases (cycle_id, target_id, evaluator_id, stage)
select 1, t.id, l.id, 'leader'
from employees t
join employees l
  on l.department_id = t.department_id and l.role = 'leader' and l.status = 'active'
where t.role = 'member' and t.status = 'active' and not t.excluded;

-- 3) 임원 평가: 팀원·팀장 모두 1건
insert into cases (cycle_id, target_id, evaluator_id, stage)
select 1, t.id,
       (select x.id from employees x
        where x.role = 'executive' and x.status = 'active'
        order by x.id limit 1),
       'executive'
from employees t
where t.role in ('member', 'leader') and t.status = 'active' and not t.excluded;

-- 4) 상향 평가: 팀장마다 같은 부서 팀원 각자 1건
insert into cases (cycle_id, target_id, evaluator_id, stage)
select 1, t.id, m.id, 'upward'
from employees t
join employees m
  on m.department_id = t.department_id and m.role = 'member' and m.status = 'active'
where t.role = 'leader' and t.status = 'active' and not t.excluded;

-- 검사: 102건이 아니면 오류
do $$
declare v_count integer;
begin
  select count(*) into v_count from cases where cycle_id = 1;
  if v_count <> 102 then
    raise exception '평가 건이 %건입니다 (102건이어야 함)', v_count;
  end if;
end
$$;
