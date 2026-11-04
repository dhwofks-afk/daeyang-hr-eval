-- 013_questions_v3.sql : 팀장·상향 평가표 교체 · 평가 불참 직급(대표이사·부사장) (11/4 차장님 답변)
--
-- 실행 방법: 012 다음에 SQL Editor에서 이 파일 전체를 실행한다. 여러 번 실행해도 안전하다.
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 실행 후 맨 아래 확인 쿼리를 따로 돌려 실제로 바뀌었는지 확인한다.
-- 그다음 supabase/seed/90_demo_reset.sql을 실행한다 (시연 답을 새 문항으로 다시 넣는다).
--
-- 바뀌는 것
-- 1) 직급 표에 "평가 불참" 칸(no_evaluation). 대표이사·부사장 = 평가 불참
--    직급 순서는 011 그대로: 대리3 < 주임연구원4(대리급) < 과장5 < 선임연구원6(과장급) < 차장7
-- 2) 직원의 직급이 평가 불참이면 저장할 때 자동으로 평가 제외(excluded = true). 명단 올리기·조직도 수정 모두
-- 3) 평가 관계 규칙: 평가 불참 직급의 임원은 임원 평가자·임원 상향 대상에서 빠진다
-- 4) "평가 전" 회차의 팀장 평가표(관리직·생산직)·상향 평가표 문항을 새 평가표로 바꾼다 (구분마다 1문항, 팀원 평가표는 그대로)
--    이미 새 평가표면 건너뛴다. 바뀐 문항의 답은 지워지므로 90 시연 초기화를 다시 실행한다.
--    "평가 중" 이후 회차는 문항이 잠겨 있어 건너뛴다.

begin;

-- ---------------------------------------------------------------
-- 1) 직급: 평가 불참 칸
-- ---------------------------------------------------------------
alter table positions add column if not exists no_evaluation boolean not null default false;
comment on column positions.no_evaluation is '평가 불참 직급 (평가 대상도 평가자도 아님)';
update positions set no_evaluation = (name in ('대표이사', '부사장'))
where no_evaluation is distinct from (name in ('대표이사', '부사장'));


-- ---------------------------------------------------------------
-- 2) 평가 불참 직급이면 자동으로 평가 제외
-- ---------------------------------------------------------------
-- security definer: 계정 만들기(관리용 열쇠)처럼 직급 표 권한이 없는 쪽이 직원 표를 고칠 때도 동작하게
create or replace function public.exclude_no_evaluation_position()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.positions p where p.name = new.position and p.no_evaluation) then
    new.excluded := true;
  end if;
  return new;
end;
$$;

drop trigger if exists employees_no_evaluation on public.employees;
create trigger employees_no_evaluation
  before insert or update on public.employees
  for each row execute function public.exclude_no_evaluation_position();

revoke execute on function public.exclude_no_evaluation_position() from public, anon, authenticated;

-- 지금 있는 직원에도 적용
update employees e set excluded = true
from positions p
where p.name = e.position and p.no_evaluation and not e.excluded;


-- ---------------------------------------------------------------
-- 3) 평가 관계 규칙 다시 정의 (011): 평가 불참 직급의 임원은 빠진다
-- ---------------------------------------------------------------
create or replace function public.rule_relations_base()
returns table (target_id integer, evaluator_id integer, stage text)
language sql stable
set search_path = ''
as $$
  with execs as (
    select x.id, x.department_id, coalesce(p.sort_order, 0) as rank
    from public.employees x
    left join public.positions p on p.name = x.position
    where x.role = 'executive' and x.status = 'active'
      and not coalesce(p.no_evaluation, false)   -- 013: 대표이사·부사장 등 평가 불참 직급은 평가자도 안 함
  ),
  top_exec as (
    select id from execs order by rank desc, id limit 1
  ),
  dept_exec as (
    select distinct on (department_id) department_id, id
    from execs order by department_id, rank desc, id
  ),
  people as (   -- 팀원·팀장 (재직) + 그 사람을 평가하는 임원
    select t.*, coalesce(d.id, (select id from top_exec)) as exec_id
    from public.employees t
    left join dept_exec d on d.department_id = t.department_id
    where t.role in ('member', 'leader') and t.status = 'active'
  ),
  targets as (
    select * from people where not excluded
  )
  select t.id, t.id, 'self' from targets t
  union all
  select t.id, l.id, 'leader'
  from targets t
  join public.employees l
    on l.department_id = t.department_id and l.role = 'leader' and l.status = 'active'
  where t.role = 'member'
  union all
  select t.id, t.exec_id, 'executive' from targets t where t.exec_id is not null
  union all
  select t.id, m.id, 'upward'
  from targets t
  join public.employees m
    on m.department_id = t.department_id and m.role = 'member' and m.status = 'active'
  where t.role = 'leader'
  union all
  select e.id, p.id, 'exec_upward'
  from public.employees e
  join people p on p.exec_id = e.id
  where e.role = 'executive' and e.status = 'active' and not e.excluded
$$;

revoke execute on function public.rule_relations_base() from public, anon, authenticated;


-- ---------------------------------------------------------------
-- 4) "평가 전" 회차의 팀장·상향 평가표 교체
-- ---------------------------------------------------------------
do $$
declare
  v_cycle record;
begin
  for v_cycle in select id, status from public.cycles order by id loop
    -- 새 평가표 = 팀장 평가표가 5문항이고 구분에 "리더십 및 조직관리"가 있음 (항목별로 나눈 16문항 시안도 다시 바꾼다)
    if (select count(*) from public.questions q
        where q.cycle_id = v_cycle.id and q.question_set = 'office_leader') = 5
       and exists (select 1 from public.questions q
                   where q.cycle_id = v_cycle.id and q.question_set = 'office_leader'
                     and q.field = '리더십 및 조직관리') then
      raise notice '회차 %: 이미 새 평가표라 건너뜀', v_cycle.id;
      continue;
    end if;
    if not exists (select 1 from public.questions q where q.cycle_id = v_cycle.id) then
      continue;   -- 문항이 없는 회차 (새 프로젝트에서는 seed 03이 새 평가표를 넣는다)
    end if;
    if v_cycle.status <> 'before' then
      raise notice '회차 %: "평가 전"이 아니라 문항이 잠겨 건너뜀', v_cycle.id;
      continue;
    end if;

    delete from public.answers a
    using public.questions q
    where a.question_id = q.id and q.cycle_id = v_cycle.id
      and q.question_set in ('office_leader', 'production_leader', 'upward');
    delete from public.questions
    where cycle_id = v_cycle.id and question_set in ('office_leader', 'production_leader', 'upward');

    insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order) values
  (v_cycle.id, 'office_leader', '업무성과', '부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적', 30, '부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적', 'choice', 1),
  (v_cycle.id, 'office_leader', '리더십 및 조직관리', '업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력', 25, '업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력', 'choice', 2),
  (v_cycle.id, 'office_leader', '직무역량 및 의사결정', '직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성', 20, '직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성', 'choice', 3),
  (v_cycle.id, 'office_leader', '책임감 및 규정준수', '관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응', 15, '관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응', 'choice', 4),
  (v_cycle.id, 'office_leader', '협업 및 조직기여', '타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여', 10, '타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여', 'choice', 5),
  (v_cycle.id, 'production_leader', '업무성과', '부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적', 30, '부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적', 'choice', 1),
  (v_cycle.id, 'production_leader', '리더십 및 조직관리', '업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력', 25, '업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력', 'choice', 2),
  (v_cycle.id, 'production_leader', '직무역량 및 의사결정', '직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성', 20, '직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성', 'choice', 3),
  (v_cycle.id, 'production_leader', '책임감 및 규정준수', '관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응', 15, '관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응', 'choice', 4),
  (v_cycle.id, 'production_leader', '협업 및 조직기여', '타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여', 10, '타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여', 'choice', 5),
  (v_cycle.id, 'upward', '업무지시 및 관리능력', '업무지시의 명확성, 업무분장의 적정성, 업무 진행상황 관리', 25, '업무지시의 명확성, 업무분장의 적정성, 업무 진행상황 관리', 'choice', 1),
  (v_cycle.id, 'upward', '리더십 및 의사결정', '문제해결 능력, 합리적인 의사결정, 책임 있는 업무처리', 25, '문제해결 능력, 합리적인 의사결정, 책임 있는 업무처리', 'choice', 2),
  (v_cycle.id, 'upward', '소통 및 피드백', '구성원 의견 경청, 원활한 의사소통, 적절한 업무지도 및 피드백', 20, '구성원 의견 경청, 원활한 의사소통, 적절한 업무지도 및 피드백', 'choice', 3),
  (v_cycle.id, 'upward', '공정성 및 신뢰성', '구성원에 대한 공정한 대우, 객관적인 업무평가, 일관된 원칙 적용', 20, '구성원에 대한 공정한 대우, 객관적인 업무평가, 일관된 원칙 적용', 'choice', 4),
  (v_cycle.id, 'upward', '조직문화 및 협업', '상호존중, 갈등관리, 협력적인 근무환경 조성', 10, '상호존중, 갈등관리, 협력적인 근무환경 조성', 'choice', 5);

    raise notice '회차 %: 팀장·상향 평가표를 새 평가표로 바꿈 (90 시연 초기화를 다시 실행할 것)', v_cycle.id;
  end loop;
end
$$;

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다
-- ---------------------------------------------------------------
-- select
--   (select string_agg(name, ', ' order by sort_order) from public.positions where no_evaluation) as "1 평가 불참 직급",
--   (select string_agg(name || sort_order, ' ' order by sort_order) from public.positions
--     where name in ('대리', '주임연구원', '과장', '선임연구원', '차장')) as "2 직급 순서",
--   (select count(*) from pg_trigger where tgname = 'employees_no_evaluation' and not tgisinternal) as "3 자동 제외 트리거(1)",
--   (select count(*) from public.employees e join public.positions p on p.name = e.position
--     where p.no_evaluation and not e.excluded) as "4 불참인데 제외 안 된 직원(0)",
--   (select pg_get_functiondef('public.rule_relations_base'::regproc) like '%no_evaluation%') as "5 규칙",
--   (select string_agg(question_set || ' ' || n || '문항/' || pts || '점', ' · ' order by question_set)
--      from (select question_set, count(*) n,
--                   (select sum(distinct_pts) from (select distinct factor, factor_points as distinct_pts
--                      from public.questions q2 where q2.cycle_id = 1 and q2.question_set = q.question_set) d) pts
--              from public.questions q where cycle_id = 1 group by question_set) x) as "6 회차 1 문항";
-- 기대: 대표이사, 부사장 (DB에 있는 것만) / 대리3 주임연구원4 과장5 선임연구원6 차장7 / 1 / 0 / true /
--       office_leader 5문항/100점 · office_member 37문항/100점 · production_leader 5문항/100점 ·
--       production_member 33문항/100점 · upward 5문항/100점
