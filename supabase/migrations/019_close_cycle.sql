-- 019_close_cycle.sql : 평가 종료 (마감일 전이라도 관리자가 평가를 강제로 끝낸다)
--
-- 실행 방법: 018 다음에 SQL Editor에서 이 파일 전체를 실행한다 (실행: 오재란).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 여러 번 실행해도 안전하다. 실행 후 맨 아래 확인 쿼리를 따로 돌린다.
--
-- 바뀌는 것
-- 1) 상태에 closed(평가 종료) 추가: 준비 중 → 평가 중 → 평가 종료 → 완료(결과 확정)
--    평가 종료는 되돌릴 수 없다. 평가 종료에서는 직원 작성·제출과 반려가 막힌다
--    (이미 있는 잠금이 "평가 중"일 때만 받기 때문: lock_cases·lock_answers·return_case).
--    조직도 잠금(009)은 "평가 중"일 때만이라 평가 종료 후에는 완료와 같이 풀린다.
-- 2) closed_at: 평가를 종료한 시각. 확정 취소 때 어느 상태로 돌아갈지 정하는 데 쓴다.
--    평가가 "준비 중"으로 돌아가면(전체 삭제 017) 저절로 비운다.
-- 3) close_cycle(회차): 관리자만, "평가 중"인 평가만 "평가 종료"로
-- 4) publish_results: "평가 종료"인 평가도 결과 확정 가능
-- 5) unpublish_results: 종료한 적 있는 평가는 확정 취소 후 "평가 종료"로 (제출이 다시 열리지 않게)

begin;

-- ---------------------------------------------------------------
-- 1) 상태 규칙: closed 추가
-- ---------------------------------------------------------------
alter table public.cycles drop constraint if exists cycles_status_check;
alter table public.cycles add constraint cycles_status_check
  check (status in ('before', 'in_progress', 'closed', 'done'));
comment on column public.cycles.status is '상태: before 준비 중 / in_progress 평가 중 / closed 평가 종료 / done 완료(결과 확정)';


-- ---------------------------------------------------------------
-- 2) 평가 종료 시각
-- ---------------------------------------------------------------
alter table public.cycles add column if not exists closed_at timestamptz;
comment on column public.cycles.closed_at is '평가 종료 시각 (평가 종료를 누른 적 없으면 비움)';

-- 준비 중으로 돌아가면 종료 시각을 비운다 (전체 삭제 후 다시 시작한 평가가 확정 취소 때 종료로 가지 않게)
create or replace function public.clear_closed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'before' then
    new.closed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists cycles_clear_closed_at on public.cycles;
create trigger cycles_clear_closed_at
  before update on public.cycles
  for each row execute function public.clear_closed_at();

revoke execute on function public.clear_closed_at() from public, anon, authenticated;


-- ---------------------------------------------------------------
-- 3) 평가 종료: 평가 중 → 평가 종료 (되돌릴 수 없다)
-- ---------------------------------------------------------------
create or replace function public.close_cycle(p_cycle_id integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  perform public.require_admin();
  select status into v_status from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_status <> 'in_progress' then
    raise exception '"평가 중"인 평가만 종료할 수 있습니다.';
  end if;

  update public.cycles set status = 'closed', closed_at = now() where id = p_cycle_id;
end;
$$;

revoke execute on function public.close_cycle(integer) from public, anon;
grant execute on function public.close_cycle(integer) to authenticated;


-- ---------------------------------------------------------------
-- 4) 결과 확정 다시 정의 (016): 평가 종료도 확정 가능
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
  if v_status not in ('in_progress', 'closed', 'done') then
    raise exception '"평가 중" 또는 "평가 종료"인 평가만 결과를 확정할 수 있습니다.';
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


-- ---------------------------------------------------------------
-- 5) 확정 취소 다시 정의 (016): 종료한 적 있으면 평가 종료로, 아니면 평가 중으로
-- ---------------------------------------------------------------
create or replace function public.unpublish_results(p_cycle_id integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status    text;
  v_closed_at timestamptz;
  v_other     text;
begin
  perform public.require_admin();
  select status, closed_at into v_status, v_closed_at from public.cycles where id = p_cycle_id for update;
  if v_status is null then
    raise exception '평가를 찾을 수 없습니다.';
  end if;
  if v_status <> 'done' then
    raise exception '"완료"된 평가만 확정을 취소할 수 있습니다.';
  end if;

  if v_closed_at is null then
    -- 평가 중으로 돌아간다: 평가 중은 하나만
    select name into v_other from public.cycles where status = 'in_progress' and id <> p_cycle_id;
    if v_other is not null then
      raise exception '"%" 평가가 평가 중이라 확정을 취소할 수 없습니다 (평가 중은 하나만).', v_other;
    end if;
  end if;

  perform set_config('app.publish_change', 'on', true);
  update public.cycles
  set result_published = false,
      published_at = null,
      status = case when v_closed_at is null then 'in_progress' else 'closed' end
  where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
end;
$$;

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다.
-- ---------------------------------------------------------------
-- select
--   (select pg_get_constraintdef(oid) from pg_constraint where conname = 'cycles_status_check') as "1 상태 규칙 (closed 포함)",
--   (select count(*) from information_schema.columns
--     where table_schema = 'public' and table_name = 'cycles' and column_name = 'closed_at') as "2 종료 시각 칸(1)",
--   (select count(*) from pg_trigger where tgname = 'cycles_clear_closed_at') as "3 종료 시각 비우기 트리거(1)",
--   (select string_agg(p.proname, ', ' order by p.proname)
--      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname in ('close_cycle', 'publish_results', 'unpublish_results')) as "4 함수 3개";
