-- 007_relations.sql : 평가 관계 설정용 서버 함수 (docs/09-평가관계.md 3번)
--
-- 실행 방법: 006 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- 실행 후 확인 쿼리로 함수가 실제로 생겼는지 반드시 확인한다.
--
-- 규칙(누가 누구를 어느 단계로 평가하는지)은 rule_relations_base() 한 곳에만 둔다.
-- 평가 건 만들기(create_cases), 화면의 "규칙과 다름" 표시, 규칙대로 다시 만들기가 모두 이것을 쓴다.


-- ---------------------------------------------------------------
-- 내부 함수: 규칙대로라면 생겨야 할 평가 관계 (5-3 seed 04_cases.sql과 같은 규칙)
-- 대상: 재직 + 평가 제외 아님인 팀원·팀장 / 평가자: 재직
-- 자기 / 같은 부서 팀장 / 임원(재직 임원 중 내부 번호가 가장 작은 사람) / 상향(팀원 → 같은 부서 팀장)
-- 화면에서는 부를 수 없다
-- ---------------------------------------------------------------
create or replace function public.rule_relations_base()
returns table (target_id integer, evaluator_id integer, stage text)
language sql stable
set search_path = ''
as $$
  with targets as (
    select t.* from public.employees t
    where t.role in ('member', 'leader') and t.status = 'active' and not t.excluded
  ),
  executive as (
    select x.id from public.employees x
    where x.role = 'executive' and x.status = 'active'
    order by x.id limit 1
  )
  select t.id, t.id, 'self' from targets t
  union all
  select t.id, l.id, 'leader'
  from targets t
  join public.employees l
    on l.department_id = t.department_id and l.role = 'leader' and l.status = 'active'
  where t.role = 'member'
  union all
  select t.id, x.id, 'executive' from targets t cross join executive x
  union all
  select t.id, m.id, 'upward'
  from targets t
  join public.employees m
    on m.department_id = t.department_id and m.role = 'member' and m.status = 'active'
  where t.role = 'leader'
$$;


-- 규칙대로라면 생겨야 할 평가 관계 (관리자 화면의 "규칙과 다름" 표시용)
create or replace function public.rule_relations()
returns table (target_id integer, evaluator_id integer, stage text)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query select r.target_id, r.evaluator_id, r.stage from public.rule_relations_base() r;
end;
$$;


-- ---------------------------------------------------------------
-- 006의 create_cases를 다시 정의: 같은 규칙을 rule_relations_base()에서 가져온다
-- 이미 있는 건은 건너뛴다. 만든 건수를 돌려준다
-- ---------------------------------------------------------------
create or replace function public.create_cases(p_cycle_id integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.cases (cycle_id, target_id, evaluator_id, stage)
  select p_cycle_id, r.target_id, r.evaluator_id, r.stage
  from public.rule_relations_base() r
  on conflict (cycle_id, target_id, evaluator_id, stage) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- ---------------------------------------------------------------
-- 평가 관계 저장: "평가 전" 회차만. 바뀐 대상마다 원하는 상태를 받아 지금과 다른 평가 건만 고친다
--   p_changes 예: [{"target_id": 12, "leader": 10, "executive": 29, "upward": []},
--                  {"target_id": 10, "leader": null, "executive": 29, "upward": [11, 12, 14]}]
--   - leader: 팀장 평가자 (팀원 대상만). null이면 팀장 평가 없음
--   - executive: 임원 평가자. null이면 임원 평가 없음
--   - upward: 상향 평가자 목록 (팀장 대상만)
--   - 자기평가는 건드리지 않는다
-- 거부: 관리자 아님 / 평가 전 아님 / 평가 대상 아님(퇴사·평가 제외·임원) / 퇴사·없는 평가자 /
--       자기 자신 / 같은 평가자 중복 / 역할에 맞지 않는 단계 / 이미 답이 있는 평가 건의 평가자 변경·삭제
-- 하나라도 거부되면 아무것도 저장하지 않는다. 고친 건수(추가 + 삭제)를 돌려준다
-- ---------------------------------------------------------------
create or replace function public.save_relations(p_cycle_id integer, p_changes jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_item    jsonb;
  v_target  public.employees%rowtype;
  v_stage   text;
  v_wanted  integer[];
  v_current record;
  v_ev      integer;
  v_name    text;
  v_count   integer := 0;
begin
  perform public.require_admin();
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '회차를 찾을 수 없습니다.';
  end if;
  if v_status <> 'before' then
    raise exception '평가가 시작되어 수정할 수 없습니다.';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'array' then
    raise exception '저장할 내용이 없습니다.';
  end if;

  for v_item in select * from jsonb_array_elements(p_changes) loop
    select * into v_target from public.employees where id = (v_item ->> 'target_id')::integer;
    if not found or v_target.status <> 'active' or v_target.excluded
       or v_target.role not in ('member', 'leader') then
      raise exception '평가 대상이 아닌 사람이 들어 있습니다.';
    end if;

    foreach v_stage in array array['leader', 'executive', 'upward'] loop
      -- 원하는 평가자 목록
      if v_stage = 'upward' then
        select coalesce(array_agg(value::integer), '{}') into v_wanted
        from jsonb_array_elements_text(coalesce(v_item -> 'upward', '[]'));
      else
        v_wanted := case when v_item ->> v_stage is null then '{}'
                         else array[(v_item ->> v_stage)::integer] end;
      end if;

      -- 역할에 맞지 않는 단계
      if cardinality(v_wanted) > 0 and (
           (v_stage = 'leader' and v_target.role <> 'member')
        or (v_stage = 'upward' and v_target.role <> 'leader')) then
        raise exception '%님에게는 % 단계를 둘 수 없습니다.', v_target.name,
          case v_stage when 'leader' then '팀장 평가' else '상향 평가' end;
      end if;
      -- 중복
      if cardinality(v_wanted) <> (select count(distinct w) from unnest(v_wanted) w) then
        raise exception '%님의 평가자가 중복되었습니다.', v_target.name;
      end if;
      -- 평가자 검사: 재직 직원, 자기 자신 아님
      foreach v_ev in array v_wanted loop
        if v_ev = v_target.id then
          raise exception '%님 자신을 평가자로 넣을 수 없습니다.', v_target.name;
        end if;
        if not exists (select 1 from public.employees e where e.id = v_ev and e.status = 'active') then
          raise exception '%님의 평가자 중 재직 직원이 아닌 사람이 있습니다.', v_target.name;
        end if;
      end loop;

      -- 빠진 평가자: 삭제 (답이 있으면 거부)
      for v_current in
        select c.id, c.evaluator_id from public.cases c
        where c.cycle_id = p_cycle_id and c.target_id = v_target.id and c.stage = v_stage
          and not (c.evaluator_id = any (v_wanted))
      loop
        if exists (select 1 from public.answers a where a.case_id = v_current.id) then
          select e.name into v_name from public.employees e where e.id = v_current.evaluator_id;
          raise exception '%님 → %님 평가는 이미 답이 있어 바꾸거나 지울 수 없습니다.', v_name, v_target.name;
        end if;
        delete from public.return_logs where case_id = v_current.id;
        delete from public.cases where id = v_current.id;
        v_count := v_count + 1;
      end loop;

      -- 새 평가자: 추가
      insert into public.cases (cycle_id, target_id, evaluator_id, stage)
      select p_cycle_id, v_target.id, w, v_stage
      from unnest(v_wanted) w
      where not exists (
        select 1 from public.cases c
        where c.cycle_id = p_cycle_id and c.target_id = v_target.id and c.stage = v_stage and c.evaluator_id = w
      );
      get diagnostics v_ev = row_count;
      v_count := v_count + v_ev;
    end loop;
  end loop;

  return v_count;
end;
$$;


-- ---------------------------------------------------------------
-- 규칙대로 다시 만들기: "평가 전" 회차만.
-- 답이 없는 평가 건은 모두 지우고 규칙대로 다시 만든다. 답이 있는 평가 건은 그대로 둔다
-- (답이 있는 건은 평가 관계 저장으로도 바꿀 수 없으므로 규칙과 같은 상태다)
-- 지운 건수와 만든 건수를 돌려준다
-- ---------------------------------------------------------------
create or replace function public.regenerate_cases(p_cycle_id integer)
returns table (deleted integer, created integer)
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status  text;
  v_deleted integer;
begin
  perform public.require_admin();
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '회차를 찾을 수 없습니다.';
  end if;
  if v_status <> 'before' then
    raise exception '평가가 시작되어 수정할 수 없습니다.';
  end if;

  delete from public.return_logs l
  using public.cases c
  where l.case_id = c.id and c.cycle_id = p_cycle_id
    and not exists (select 1 from public.answers a where a.case_id = c.id);

  delete from public.cases c
  where c.cycle_id = p_cycle_id
    and not exists (select 1 from public.answers a where a.case_id = c.id);
  get diagnostics v_deleted = row_count;

  return query select v_deleted, public.create_cases(p_cycle_id);
end;
$$;


-- ---------------------------------------------------------------
-- 함수 호출 권한: 로그인한 사람만 (관리자 확인은 함수 안에서). 내부 함수는 아무에게도 주지 않는다
-- ---------------------------------------------------------------
revoke execute on function public.rule_relations_base() from public, anon, authenticated;
revoke execute on function public.create_cases(integer) from public, anon, authenticated;

revoke execute on function public.rule_relations() from public, anon;
revoke execute on function public.save_relations(integer, jsonb) from public, anon;
revoke execute on function public.regenerate_cases(integer) from public, anon;

grant execute on function public.rule_relations() to authenticated;
grant execute on function public.save_relations(integer, jsonb) to authenticated;
grant execute on function public.regenerate_cases(integer) to authenticated;
