-- 011_exec_eval.sql : 임원 평가 · 팀장 비율 변경 · 전체 삭제 (11/3 결정)
--
-- 실행 방법: 010 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- 실행 후 확인 쿼리로 칸·함수·규칙이 실제로 바뀌었는지 반드시 확인한다.
--
-- 바뀌는 것
-- 1) 새 단계 "임원 상향"(exec_upward): 같은 부서 팀원·팀장이 임원을 평가한다. 임원도 평가 대상
-- 2) 비율: 팀장 = 개인 20 + 부서 KPI 40 + 상향 40 / 임원 = 임원 상향 40 + 부서 KPI 60
--          임원 상향 = 팀원 평균 50 + 팀장 평균 50
-- 3) 평가 관계 기본 규칙: 임원 평가자 = 같은 부서 임원, 없으면 직급이 가장 높은 임원(같으면 내부 번호 작은 사람)
--    임원 상향 = 같은 기준의 반대 방향 (그 임원에게 평가받는 팀원·팀장 → 그 임원)
-- 4) 직급 추가: 주임연구원·선임연구원·팀장·연구소장·대표이사 (순서는 아래 6번, 회사 확인 전 임시)
-- 5) 전체 삭제 함수: 평가 기록만 지운다 (직원·계정·문항·설정은 남긴다)


-- ---------------------------------------------------------------
-- 1) 평가 건 단계에 임원 상향 추가
-- ---------------------------------------------------------------
alter table cases drop constraint cases_stage_check;
alter table cases add constraint cases_stage_check
  check (stage in ('self', 'leader', 'executive', 'upward', 'exec_upward'));


-- ---------------------------------------------------------------
-- 2) 회차 설정: 팀장 비율 기본값 20/40/40 + 임원 비율 칸
-- ---------------------------------------------------------------
alter table cycles drop constraint cycles_mix_leader_sum;
alter table cycles alter column mix_leader_personal set default 20;
alter table cycles alter column mix_leader_kpi      set default 40;
update cycles set mix_leader_personal = 20, mix_leader_kpi = 40, mix_leader_upward = 40
where not result_published;
alter table cycles add constraint cycles_mix_leader_sum
  check (mix_leader_personal + mix_leader_kpi + mix_leader_upward = 100);

alter table cycles
  add column mix_exec_upward    numeric(5, 2) not null default 40,  -- 임원: 임원 상향
  add column mix_exec_kpi       numeric(5, 2) not null default 60,  -- 임원: 부서 KPI
  add column exec_upward_member numeric(5, 2) not null default 50,  -- 임원 상향 안: 팀원 평균
  add column exec_upward_leader numeric(5, 2) not null default 50;  -- 임원 상향 안: 팀장 평균

alter table cycles
  add constraint cycles_mix_exec_range check (
    mix_exec_upward between 0 and 100 and mix_exec_kpi between 0 and 100 and
    exec_upward_member between 0 and 100 and exec_upward_leader between 0 and 100),
  add constraint cycles_mix_exec_sum check (mix_exec_upward + mix_exec_kpi = 100),
  add constraint cycles_exec_upward_sum check (exec_upward_member + exec_upward_leader = 100);

-- 확정 결과: 임원 상향 점수 칸
alter table final_results add column score_exec_upward numeric(5, 1);   -- 임원 상향 (임원만)


-- ---------------------------------------------------------------
-- 3) 잠금 장치 1 다시 정의 (010): 임원 비율 칸도 결과 확정 후 잠근다
-- ---------------------------------------------------------------
create or replace function public.lock_published_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.result_published is distinct from old.result_published
     and coalesce(current_setting('app.publish_change', true), '') <> 'on' then
    raise exception '결과 확정·확정 취소는 리포트의 [결과 확정]·[확정 취소]로만 할 수 있습니다.';
  end if;

  if old.result_published and (
       new.weight_member_self      is distinct from old.weight_member_self
    or new.weight_member_leader    is distinct from old.weight_member_leader
    or new.weight_member_executive is distinct from old.weight_member_executive
    or new.weight_leader_self      is distinct from old.weight_leader_self
    or new.weight_leader_executive is distinct from old.weight_leader_executive
    or new.mix_member_personal     is distinct from old.mix_member_personal
    or new.mix_member_kpi          is distinct from old.mix_member_kpi
    or new.mix_leader_personal     is distinct from old.mix_leader_personal
    or new.mix_leader_kpi          is distinct from old.mix_leader_kpi
    or new.mix_leader_upward       is distinct from old.mix_leader_upward
    or new.mix_exec_upward         is distinct from old.mix_exec_upward
    or new.mix_exec_kpi            is distinct from old.mix_exec_kpi
    or new.exec_upward_member      is distinct from old.exec_upward_member
    or new.exec_upward_leader      is distinct from old.exec_upward_leader
  ) then
    raise exception '결과가 확정된 회차는 점수 설정을 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------
-- 4) 결과 확정 함수 다시 정의 (010): 임원 상향 점수 칸 추가
--    p_results 한 줄에 "score_exec_upward" (임원만, 그 밖에는 null)
-- ---------------------------------------------------------------
create or replace function public.publish_results(p_cycle_id integer, p_results jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now   timestamptz := now();
  v_count integer;
begin
  perform public.require_admin();
  if not exists (select 1 from public.cycles where id = p_cycle_id) then
    raise exception '회차를 찾을 수 없습니다.';
  end if;
  if p_results is null or jsonb_typeof(p_results) <> 'array' or jsonb_array_length(p_results) = 0 then
    raise exception '확정할 결과가 없습니다.';
  end if;

  insert into public.final_results (
    cycle_id, employee_id, department_name,
    score_self, score_leader, score_executive, score_upward, score_exec_upward,
    weighted, kpi_applied, final, published_at
  )
  select p_cycle_id, r.employee_id, r.department_name,
         r.score_self, r.score_leader, r.score_executive, r.score_upward, r.score_exec_upward,
         r.weighted, r.kpi_applied, r.final, v_now
  from jsonb_to_recordset(p_results) as r (
    employee_id integer, department_name text,
    score_self numeric, score_leader numeric, score_executive numeric, score_upward numeric,
    score_exec_upward numeric, weighted numeric, kpi_applied numeric, final numeric
  )
  on conflict (cycle_id, employee_id) do update set
    department_name   = excluded.department_name,
    score_self        = excluded.score_self,
    score_leader      = excluded.score_leader,
    score_executive   = excluded.score_executive,
    score_upward      = excluded.score_upward,
    score_exec_upward = excluded.score_exec_upward,
    weighted          = excluded.weighted,
    kpi_applied       = excluded.kpi_applied,
    final             = excluded.final,
    published_at      = excluded.published_at;
  get diagnostics v_count = row_count;

  perform set_config('app.publish_change', 'on', true);
  update public.cycles set result_published = true, published_at = v_now where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
  return v_count;
end;
$$;


-- ---------------------------------------------------------------
-- 5) 새 회차 함수 다시 정의 (010): 임원 비율 칸도 복사
-- ---------------------------------------------------------------
create or replace function public.new_cycle(p_name text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_last integer;
  v_new  integer;
begin
  perform public.require_admin();
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '회차 이름을 입력해 주세요.';
  end if;

  select max(id) into v_last from public.cycles;
  if v_last is null then
    raise exception '복사할 직전 회차가 없습니다.';
  end if;
  v_new := v_last + 1;

  insert into public.cycles (
    id, name, status, start_date, deadline,
    weight_member_self, weight_member_leader, weight_member_executive,
    weight_leader_self, weight_leader_executive,
    mix_member_personal, mix_member_kpi,
    mix_leader_personal, mix_leader_kpi, mix_leader_upward,
    mix_exec_upward, mix_exec_kpi, exec_upward_member, exec_upward_leader,
    result_published, published_at
  )
  select v_new, trim(p_name), 'before', null, null,
         weight_member_self, weight_member_leader, weight_member_executive,
         weight_leader_self, weight_leader_executive,
         mix_member_personal, mix_member_kpi,
         mix_leader_personal, mix_leader_kpi, mix_leader_upward,
         mix_exec_upward, mix_exec_kpi, exec_upward_member, exec_upward_leader,
         false, null
  from public.cycles where id = v_last;

  insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order)
  select v_new, question_set, field, factor, factor_points, content, type, sort_order
  from public.questions where cycle_id = v_last;

  perform public.create_cases(v_new);
  return v_new;
end;
$$;


-- ---------------------------------------------------------------
-- 6) 직급 추가 (회사 확인 전 임시 순서. 숫자가 클수록 높은 직급)
--    사원1 주임2 대리3 주임연구원4 과장5 선임연구원6 차장7 부장8 팀장9 이사10 연구소장11 상무12 부사장13 대표이사14 회장15
-- ---------------------------------------------------------------
update positions set sort_order = sort_order + 100;   -- 겹치지 않게 잠시 비켜 둔다 (순서 칸은 겹칠 수 없음)
insert into positions (name, sort_order) values
  ('주임연구원', 104), ('선임연구원', 106), ('팀장', 109), ('연구소장', 111), ('대표이사', 114);
update positions p set sort_order = v.ord
from (values
  ('사원', 1), ('주임', 2), ('대리', 3), ('주임연구원', 4), ('과장', 5), ('선임연구원', 6), ('차장', 7),
  ('부장', 8), ('팀장', 9), ('이사', 10), ('연구소장', 11), ('상무', 12), ('부사장', 13), ('대표이사', 14), ('회장', 15)
) as v(name, ord)
where p.name = v.name;


-- ---------------------------------------------------------------
-- 7) 평가 관계 규칙 다시 정의 (007): 임원 평가·임원 상향
--    평가 대상: 재직 + 평가 제외 아님인 팀원·팀장·임원 / 평가자: 재직
--    자기(팀원·팀장) / 팀장(팀원 → 같은 부서 팀장) / 임원(팀원·팀장 → 그 부서 임원) /
--    상향(같은 부서 팀원 → 팀장) / 임원 상향(그 임원에게 평가받는 팀원·팀장 → 임원)
--    "그 부서 임원" = 같은 부서 재직 임원(여럿이면 직급 높은 순·내부 번호 작은 순 첫 사람),
--                    없으면 전체 재직 임원 중 직급이 가장 높은 사람 (같으면 내부 번호 작은 사람)
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
-- 8) 평가 관계 저장 다시 정의 (007): 임원 대상 + 임원 상향 단계
--   p_changes 한 줄: {"target_id", "leader", "executive", "upward": [...], "exec_upward": [...]}
--   - leader: 팀원 대상만 / executive: 팀원·팀장 대상만 / upward: 팀장 대상만 / exec_upward: 임원 대상만
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
    if not found or v_target.status <> 'active' or v_target.excluded then
      raise exception '평가 대상이 아닌 사람이 들어 있습니다.';
    end if;

    foreach v_stage in array array['leader', 'executive', 'upward', 'exec_upward'] loop
      if v_stage in ('upward', 'exec_upward') then
        select coalesce(array_agg(value::integer), '{}') into v_wanted
        from jsonb_array_elements_text(coalesce(v_item -> v_stage, '[]'));
      else
        v_wanted := case when v_item ->> v_stage is null then '{}'
                         else array[(v_item ->> v_stage)::integer] end;
      end if;

      if cardinality(v_wanted) > 0 and (
           (v_stage = 'leader'      and v_target.role <> 'member')
        or (v_stage = 'executive'   and v_target.role = 'executive')
        or (v_stage = 'upward'      and v_target.role <> 'leader')
        or (v_stage = 'exec_upward' and v_target.role <> 'executive')) then
        raise exception '%님에게는 % 단계를 둘 수 없습니다.', v_target.name,
          case v_stage when 'leader' then '팀장 평가' when 'executive' then '임원 평가'
                       when 'upward' then '상향 평가' else '임원 상향 평가' end;
      end if;
      if cardinality(v_wanted) <> (select count(distinct w) from unnest(v_wanted) w) then
        raise exception '%님의 평가자가 중복되었습니다.', v_target.name;
      end if;
      foreach v_ev in array v_wanted loop
        if v_ev = v_target.id then
          raise exception '%님 자신을 평가자로 넣을 수 없습니다.', v_target.name;
        end if;
        if not exists (select 1 from public.employees e where e.id = v_ev and e.status = 'active') then
          raise exception '%님의 평가자 중 재직 직원이 아닌 사람이 있습니다.', v_target.name;
        end if;
      end loop;

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
-- 9) 잠금 장치 3 다시 정의 (006): 전체 삭제 함수 안에서만 평가 중 평가 건 삭제 허용
-- ---------------------------------------------------------------
create or replace function public.lock_cases()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  -- 전체 삭제(delete_evaluation_records) 안에서는 막지 않는다
  if tg_op = 'DELETE' and coalesce(current_setting('app.records_delete', true), '') = 'on' then
    return old;
  end if;

  select c.status into v_status from public.cycles c
  where c.id = case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end;

  if tg_op in ('INSERT', 'DELETE') then
    if v_status <> 'before' then
      raise exception '평가가 시작된 회차에는 평가 건을 추가하거나 지울 수 없습니다.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if (new.cycle_id, new.target_id, new.evaluator_id, new.stage)
     is distinct from (old.cycle_id, old.target_id, old.evaluator_id, old.stage)
     and (v_status <> 'before'
          or exists (select 1 from public.cycles c where c.id = old.cycle_id and c.status <> 'before')) then
    raise exception '평가가 시작된 회차의 평가 대상·평가자는 바꿀 수 없습니다.';
  end if;
  if not public.is_admin() and v_status <> 'in_progress' then
    raise exception '평가 중일 때만 작성할 수 있습니다.';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------
-- 10) 전체 삭제 (관리자): 평가 기록만 지운다. 확인 글자 "삭제"를 서버도 확인한다
--     지우는 것: 평가 건·답·확정 결과·보정·반려·건의·만족도(내용·제출 여부)
--     남기는 것: 직원·계정·문항·회차 설정·부서·직급. 지운 줄 수를 돌려준다
--     화면은 전체 내려받기를 한 뒤에만 이 버튼을 연다
-- ---------------------------------------------------------------
create or replace function public.delete_evaluation_records(p_confirm text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_total integer := 0;
  v_n     integer;
begin
  perform public.require_admin();
  if coalesce(trim(p_confirm), '') <> '삭제' then
    raise exception '확인 글자 "삭제"를 입력해 주세요.';
  end if;

  delete from public.return_logs;       get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.answers;           get diagnostics v_n = row_count; v_total := v_total + v_n;
  perform set_config('app.records_delete', 'on', true);
  delete from public.cases;             get diagnostics v_n = row_count; v_total := v_total + v_n;
  perform set_config('app.records_delete', 'off', true);
  delete from public.final_results;     get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.adjustments;       get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.suggestions;       get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.satisfaction;      get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.satisfaction_done; get diagnostics v_n = row_count; v_total := v_total + v_n;
  return v_total;
end;
$$;

revoke execute on function public.delete_evaluation_records(text) from public, anon;
grant execute on function public.delete_evaluation_records(text) to authenticated;
