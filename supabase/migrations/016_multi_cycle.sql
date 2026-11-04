-- 016_multi_cycle.sql : 평가 여러 개 (평가 목록에서 추가·결과 삭제·삭제) (11/4 결정)
--
-- ⚠️ 016 실행 직후 90 실행 (supabase/seed/90_demo_reset.sql). 90도 새 구조에 맞게 바뀌었다.
--
-- 실행 방법: 015 다음에 SQL Editor에서 이 파일 전체를 실행한다 (실행: 오재란).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 여러 번 실행해도 안전하다 (이미 있는 표·규칙은 건너뛰거나 다시 만든다). 실행 후 맨 아래 확인 쿼리를 따로 돌린다.
--
-- 평가(= 회차) 상태
--   before 준비 중 (문항·관계 수정 가능, 여러 개 가능)
--   → in_progress 평가 중 (한 번에 하나만)
--   → done 완료 (결과 확정. 리포트 [결과 확정]이 평가 중 → 완료로 바꾸고, [확정 취소]가 완료 → 평가 중으로 되돌린다)
--   → cleared 결과 삭제됨 (평가 카드·문항·비율·KPI는 남고 개인 결과만 지워진 상태)
--
-- 바뀌는 것
-- 1) 상태 규칙에 cleared 추가. 이미 결과가 확정된 "평가 중" 회차는 "완료"로 맞춘다
-- 2) "평가 중"은 한 번에 하나만 (부분 유일 색인). 평가 시작 함수도 먼저 확인해 알기 쉬운 오류를 낸다
-- 3) 회차별 부서 KPI 표 cycle_kpis: 지금 부서 KPI(departments.kpi)를 모든 회차에 복사해 넣는다
--    결과가 확정된 회차(완료·결과 삭제됨 포함)의 KPI는 바꿀 수 없다. departments.kpi 칸은 남기지만 화면은 더 쓰지 않는다
-- 4) new_cycle(이름, 복사할 회차): 그 회차의 비율·문항·부서 KPI를 복사한 "준비 중" 평가를 만들고, 평가 관계는 규칙대로 새로 만든다
--    옛 new_cycle(이름)은 지운다
-- 5) clear_cycle_results(회차, "삭제"): 완료된 평가의 개인 결과만 지운다 → "결과 삭제됨"
--    지우는 것: 평가 건·답·종합 의견(평가 건의 의견)·확정 결과·보정·반려·건의·만족도(내용·제출 여부)·자기관찰
--    남기는 것: 평가 카드·문항·비율·부서 KPI
-- 6) delete_cycle(회차, "삭제"): "준비 중" 또는 "결과 삭제됨"인 평가 카드를 통째로 지운다 (마지막 하나는 못 지운다)
-- 7) 결과 확정·확정 취소 함수: 상태도 함께 바꾼다 (평가 중 ↔ 완료)
-- 8) 회차 끝내기 함수(finish_cycle)는 지운다 (데이터 관리의 "새 해 평가 시작 순서"가 없어짐. 완료는 결과 확정으로만)
-- 9) 문항 잠금(006)에 평가 삭제 함수 안에서만 여는 예외 추가

begin;

-- ---------------------------------------------------------------
-- 0) 평가 중인 회차가 둘 이상이면 멈춘다 (2번 규칙을 만들 수 없음)
-- ---------------------------------------------------------------
do $$
begin
  if (select count(*) from public.cycles where status = 'in_progress' and not result_published) > 1 then
    raise exception '평가 중인 회차가 둘 이상입니다. 하나만 남기고 정리한 뒤 다시 실행해 주세요.';
  end if;
end;
$$;


-- ---------------------------------------------------------------
-- 1) 상태 규칙: cleared 추가 (옛 규칙은 이름이 정해져 있지 않아 정의로 찾아 지운다)
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cycles'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%in_progress%'
  loop
    execute format('alter table public.cycles drop constraint %I', r.conname);
  end loop;
end;
$$;
alter table cycles add constraint cycles_status_check
  check (status in ('before', 'in_progress', 'done', 'cleared'));
comment on column cycles.status is '상태: before 준비 중 / in_progress 평가 중 / done 완료(결과 확정) / cleared 결과 삭제됨';

-- 이미 결과가 확정된 "평가 중" 회차 → "완료"
update cycles set status = 'done' where status = 'in_progress' and result_published;


-- ---------------------------------------------------------------
-- 2) "평가 중"은 한 번에 하나만
-- ---------------------------------------------------------------
create unique index if not exists cycles_one_in_progress on cycles (status) where status = 'in_progress';

create or replace function public.start_cycle(p_cycle_id integer, p_start date, p_deadline date)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
  v_other  text;
begin
  perform public.require_admin();
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_status <> 'before' then
    raise exception '"준비 중" 평가만 시작할 수 있습니다.';
  end if;
  select name into v_other from public.cycles where status = 'in_progress' and id <> p_cycle_id;
  if v_other is not null then
    raise exception '"%" 평가가 평가 중입니다. 평가 중은 한 번에 하나만 둘 수 있습니다.', v_other;
  end if;
  if p_start is not null and p_deadline is not null and p_deadline < p_start then
    raise exception '마감일은 시작일보다 앞설 수 없습니다.';
  end if;

  -- 평가 건은 "준비 중"일 때만 만들 수 있으므로 상태를 바꾸기 전에 만든다
  if not exists (select 1 from public.cases where cycle_id = p_cycle_id) then
    perform public.create_cases(p_cycle_id);
  end if;

  update public.cycles
  set status = 'in_progress', start_date = p_start, deadline = p_deadline
  where id = p_cycle_id;
end;
$$;


-- ---------------------------------------------------------------
-- 3) 회차별 부서 KPI
-- ---------------------------------------------------------------
create table if not exists cycle_kpis (
  cycle_id      integer not null references cycles (id) on delete cascade,      -- 회차
  department_id integer not null references departments (id),                  -- 부서
  kpi           numeric(5, 1) check (kpi between 0 and 100),                     -- KPI 점수 (0~100, 아직 없으면 비움)
  primary key (cycle_id, department_id)
);
comment on table cycle_kpis is '부서 KPI (회차별)';

alter table cycle_kpis enable row level security;
revoke all on cycle_kpis from public, anon;
grant select, insert, update on public.cycle_kpis to authenticated;
drop policy if exists "부서 KPI: 관리자 읽기" on public.cycle_kpis;
drop policy if exists "부서 KPI: 관리자 추가" on public.cycle_kpis;
drop policy if exists "부서 KPI: 관리자 수정" on public.cycle_kpis;
create policy "부서 KPI: 관리자 읽기" on public.cycle_kpis
  for select to authenticated using (public.is_admin());
create policy "부서 KPI: 관리자 추가" on public.cycle_kpis
  for insert to authenticated with check (public.is_admin());
create policy "부서 KPI: 관리자 수정" on public.cycle_kpis
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- 잠금: 결과가 확정됐거나 완료·결과 삭제됨인 회차의 KPI는 넣거나 바꿀 수 없다
-- (회차 복사·이 파일의 옮겨 넣기 안에서는 app.kpi_copy = on 으로 연다)
create or replace function public.lock_cycle_kpis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.kpi_copy', true), '') = 'on' then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.kpi is distinct from old.kpi
      or new.cycle_id is distinct from old.cycle_id or new.department_id is distinct from old.department_id)
     and exists (
       select 1 from public.cycles c
       where c.id in (new.cycle_id, case when tg_op = 'UPDATE' then old.cycle_id end)
         and (c.result_published or c.status in ('done', 'cleared'))
     ) then
    raise exception '결과가 확정된 평가는 부서 KPI를 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;
revoke execute on function public.lock_cycle_kpis() from public, anon, authenticated;

drop trigger if exists cycle_kpis_lock on public.cycle_kpis;
create trigger cycle_kpis_lock
  before insert or update on public.cycle_kpis
  for each row execute function public.lock_cycle_kpis();

-- 지금 부서 KPI를 모든 회차에 옮겨 넣기 (이미 있는 칸은 그대로)
select set_config('app.kpi_copy', 'on', true);
insert into cycle_kpis (cycle_id, department_id, kpi)
select c.id, d.id, d.kpi
from cycles c cross join departments d
where not exists (select 1 from cycle_kpis k where k.cycle_id = c.id and k.department_id = d.id);
select set_config('app.kpi_copy', 'off', true);


-- ---------------------------------------------------------------
-- 4) 평가 추가: 고른 회차의 비율·문항·부서 KPI 복사 + 평가 관계는 규칙대로 새로
-- ---------------------------------------------------------------
drop function if exists public.new_cycle(text);

create or replace function public.new_cycle(p_name text, p_source integer)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_new integer;
begin
  perform public.require_admin();
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception '평가 이름을 입력해 주세요.';
  end if;
  if not exists (select 1 from public.cycles where id = p_source) then
    raise exception '복사할 평가를 찾을 수 없습니다.';
  end if;

  select max(id) + 1 into v_new from public.cycles;

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
  from public.cycles where id = p_source;

  insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order)
  select v_new, question_set, field, factor, factor_points, content, type, sort_order
  from public.questions where cycle_id = p_source;

  -- 부서 KPI: 복사할 회차 값. 그 회차에 없는 부서(나중에 생긴 부서)는 비워 둔다
  insert into public.cycle_kpis (cycle_id, department_id, kpi)
  select v_new, d.id, k.kpi
  from public.departments d
  left join public.cycle_kpis k on k.cycle_id = p_source and k.department_id = d.id;

  perform public.create_cases(v_new);
  return v_new;
end;
$$;
revoke execute on function public.new_cycle(text, integer) from public, anon;
grant execute on function public.new_cycle(text, integer) to authenticated;


-- ---------------------------------------------------------------
-- 9) 문항 잠금 다시 정의 (006): 평가 삭제 함수 안(app.cycle_delete = on)에서는 지우기를 막지 않는다
-- ---------------------------------------------------------------
create or replace function public.lock_started_questions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and coalesce(current_setting('app.cycle_delete', true), '') = 'on' then
    return old;
  end if;
  if exists (
    select 1 from public.cycles c
    where c.status <> 'before'
      and c.id in (
        case when tg_op <> 'INSERT' then old.cycle_id end,
        case when tg_op <> 'DELETE' then new.cycle_id end
      )
  ) then
    raise exception '평가가 시작된 회차의 문항은 바꿀 수 없습니다.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;


-- ---------------------------------------------------------------
-- 5) 결과 삭제 (관리자): 완료된 평가의 개인 결과만. 확인 글자 "삭제"를 서버도 확인한다
--    화면은 그 평가의 전체 내려받기를 한 뒤에만 이 버튼을 연다. 지운 줄 수를 돌려준다
-- ---------------------------------------------------------------
create or replace function public.clear_cycle_results(p_cycle_id integer, p_confirm text)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles%rowtype;
  v_total integer := 0;
  v_n     integer;
begin
  perform public.require_admin();
  if coalesce(trim(p_confirm), '') <> '삭제' then
    raise exception '확인 글자 "삭제"를 입력해 주세요.';
  end if;
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if not found then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_cycle.status <> 'done' or not v_cycle.result_published then
    raise exception '"완료"(결과 확정)된 평가만 결과를 지울 수 있습니다.';
  end if;

  delete from public.return_logs       where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.answers a using public.cases c
    where a.case_id = c.id and c.cycle_id = p_cycle_id;            get diagnostics v_n = row_count; v_total := v_total + v_n;
  perform set_config('app.records_delete', 'on', true);
  delete from public.cases             where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  perform set_config('app.records_delete', 'off', true);
  delete from public.final_results     where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.adjustments       where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.suggestions       where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.satisfaction      where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.satisfaction_done where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.self_observations where cycle_id = p_cycle_id; get diagnostics v_n = row_count; v_total := v_total + v_n;

  update public.cycles set status = 'cleared' where id = p_cycle_id;
  return v_total;
end;
$$;
revoke execute on function public.clear_cycle_results(integer, text) from public, anon;
grant execute on function public.clear_cycle_results(integer, text) to authenticated;


-- ---------------------------------------------------------------
-- 6) 평가 카드 삭제 (관리자): "준비 중" 또는 "결과 삭제됨"만. 마지막 하나는 못 지운다
-- ---------------------------------------------------------------
create or replace function public.delete_cycle(p_cycle_id integer, p_confirm text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.require_admin();
  if coalesce(trim(p_confirm), '') <> '삭제' then
    raise exception '확인 글자 "삭제"를 입력해 주세요.';
  end if;
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_status not in ('before', 'cleared') then
    raise exception '"준비 중" 또는 "결과 삭제됨"인 평가만 삭제할 수 있습니다.';
  end if;
  if (select count(*) from public.cycles) <= 1 then
    raise exception '평가가 하나뿐이라 삭제할 수 없습니다. 새 평가를 먼저 추가해 주세요.';
  end if;

  delete from public.return_logs       where cycle_id = p_cycle_id;
  delete from public.answers a using public.cases c where a.case_id = c.id and c.cycle_id = p_cycle_id;
  perform set_config('app.records_delete', 'on', true);
  delete from public.cases             where cycle_id = p_cycle_id;
  perform set_config('app.records_delete', 'off', true);
  delete from public.final_results     where cycle_id = p_cycle_id;
  delete from public.adjustments       where cycle_id = p_cycle_id;
  delete from public.suggestions       where cycle_id = p_cycle_id;
  delete from public.satisfaction      where cycle_id = p_cycle_id;
  delete from public.satisfaction_done where cycle_id = p_cycle_id;
  delete from public.self_observations where cycle_id = p_cycle_id;
  perform set_config('app.cycle_delete', 'on', true);
  delete from public.questions         where cycle_id = p_cycle_id;
  perform set_config('app.cycle_delete', 'off', true);
  update public.import_logs set cycle_id = null where cycle_id = p_cycle_id;
  delete from public.cycles            where id = p_cycle_id;   -- 부서 KPI는 함께 지워진다
end;
$$;
revoke execute on function public.delete_cycle(integer, text) from public, anon;
grant execute on function public.delete_cycle(integer, text) to authenticated;


-- ---------------------------------------------------------------
-- 7) 결과 확정·확정 취소 다시 정의 (011·006): 상태도 함께 바꾼다
-- ---------------------------------------------------------------
create or replace function public.publish_results(p_cycle_id integer, p_results jsonb)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now    timestamptz := now();
  v_count  integer;
  v_status text;
begin
  perform public.require_admin();
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_status not in ('in_progress', 'done') then
    raise exception '"평가 중"인 평가만 결과를 확정할 수 있습니다.';
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
  update public.cycles set result_published = true, published_at = v_now, status = 'done' where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
  return v_count;
end;
$$;

create or replace function public.unpublish_results(p_cycle_id integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
  v_other  text;
begin
  perform public.require_admin();
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_status <> 'done' then
    raise exception '"완료"된 평가만 확정을 취소할 수 있습니다.';
  end if;
  select name into v_other from public.cycles where status = 'in_progress' and id <> p_cycle_id;
  if v_other is not null then
    raise exception '"%" 평가가 평가 중이라 확정을 취소할 수 없습니다 (평가 중은 하나만).', v_other;
  end if;

  perform set_config('app.publish_change', 'on', true);
  update public.cycles set result_published = false, published_at = null, status = 'in_progress' where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
end;
$$;


-- ---------------------------------------------------------------
-- 8) 회차 끝내기 함수 지우기 (완료는 결과 확정으로만)
-- ---------------------------------------------------------------
drop function if exists public.finish_cycle(integer);

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다. 그다음 90 실행!
-- ---------------------------------------------------------------
-- select
--   (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cycles_status_check') as "1 상태 규칙 (cleared 포함)",
--   (select count(*) from pg_indexes where indexname = 'cycles_one_in_progress') as "2 평가 중 하나만 색인(1)",
--   (select count(*) from cycles where status = 'in_progress') as "3 평가 중 회차 수(0 또는 1)",
--   (select count(*) from cycle_kpis) = (select count(*) from cycles) * (select count(*) from departments) as "4 회차별 KPI 다 있음(true)",
--   (select count(*) from cycles where status = 'in_progress' and result_published) as "5 확정됐는데 평가 중(0)",
--   (select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')', ', ' order by p.proname)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('new_cycle', 'clear_cycle_results', 'delete_cycle', 'finish_cycle'))
--     as "6 함수 (clear_cycle_results·delete_cycle·new_cycle(text, integer)만, finish_cycle 없음)",
--   (select pg_get_functiondef('public.lock_started_questions'::regproc) like '%app.cycle_delete%') as "7 문항 잠금 예외(true)";
