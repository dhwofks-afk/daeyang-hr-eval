-- 017_full_delete.sql : 데이터 관리 [전체 삭제] 기준 정리 · 카드 삭제는 준비 중만 (docs/11-데이터관리.md, 11/4 결정)
--
-- 실행 방법: 016 다음에 SQL Editor에서 이 파일 전체를 실행한다 (실행: 오재란).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 여러 번 실행해도 안전하다 (함수는 다시 정의, 규칙은 지우고 다시 만든다). 실행 후 맨 아래 확인 쿼리를 따로 돌린다.
-- 이 파일은 평가 기록을 지우지 않는다 (함수만 고친다). 90은 다시 돌리지 않아도 된다.
--
-- 바뀌는 것
-- 1) 전체 삭제(delete_evaluation_records): 모든 평가의
--      평가 건 · 답 · 종합 의견(평가 건의 의견) · 확정 결과 · 보정 · 반려 · 자기관찰 · 만족도(내용·제출 여부) · 건의
--    를 지우고, 평가 카드는 모두 "준비 중"으로 돌린다 (결과 확정 해제).
--    남기는 것: 평가 카드 · 문항 · 반영 비율 · 부서 · 본부 · 부서 KPI · 직급 목록 · 직원 명단 · 직원 계정 · 관리자 계정
--    평가 건이 없어진 평가는 [평가 시작]을 누를 때 규칙대로 다시 만들어진다 (016 start_cycle)
-- 2) 평가 카드 삭제(delete_cycle): "준비 중"일 때만 (결과 삭제됨 상태는 쓰지 않는다)
-- 3) 평가 카드별 결과 삭제(clear_cycle_results, 016)는 지운다. "결과 삭제됨"(cleared) 평가가 있으면 "준비 중"으로 바꾸고
--    상태 규칙에서 cleared를 뺀다

begin;

-- ---------------------------------------------------------------
-- 3) 카드별 결과 삭제 없애기
-- ---------------------------------------------------------------
drop function if exists public.clear_cycle_results(integer, text);

-- 결과 삭제됨 → 준비 중 (결과가 이미 지워진 평가라 바로 준비 중으로 둘 수 있다)
select set_config('app.publish_change', 'on', true);
update cycles set status = 'before', result_published = false, published_at = null where status = 'cleared';
select set_config('app.publish_change', 'off', true);

alter table cycles drop constraint if exists cycles_status_check;
alter table cycles add constraint cycles_status_check
  check (status in ('before', 'in_progress', 'done'));
comment on column cycles.status is '상태: before 준비 중 / in_progress 평가 중 / done 완료(결과 확정)';


-- ---------------------------------------------------------------
-- 1) 전체 삭제 다시 정의 (011)
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
  delete from public.cases;             get diagnostics v_n = row_count; v_total := v_total + v_n;   -- 종합 의견 포함
  perform set_config('app.records_delete', 'off', true);
  delete from public.final_results;     get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.adjustments;       get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.self_observations; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.satisfaction;      get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.satisfaction_done; get diagnostics v_n = row_count; v_total := v_total + v_n;
  delete from public.suggestions;       get diagnostics v_n = row_count; v_total := v_total + v_n;

  -- 평가 카드는 모두 "준비 중"으로 (결과 확정도 푼다. 확정 여부는 이 표시가 켜져 있을 때만 바꿀 수 있다)
  perform set_config('app.publish_change', 'on', true);
  update public.cycles
  set status = 'before', result_published = false, published_at = null
  where status <> 'before' or result_published;
  perform set_config('app.publish_change', 'off', true);

  return v_total;
end;
$$;

revoke execute on function public.delete_evaluation_records(text) from public, anon;
grant execute on function public.delete_evaluation_records(text) to authenticated;


-- ---------------------------------------------------------------
-- 2) 평가 카드 삭제 다시 정의 (016): 준비 중만
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
  if v_status <> 'before' then
    raise exception '"준비 중"인 평가만 삭제할 수 있습니다.';
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

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다
-- 기대: 1 true / 2 true / 3 true / 4 false / 5 0 / 6 false / 7 true
-- ---------------------------------------------------------------
-- select
--   (select pg_get_functiondef('public.delete_evaluation_records(text)'::regprocedure) like '%self_observations%')
--     as "1 전체 삭제에 자기관찰(true)",
--   (select pg_get_functiondef('public.delete_evaluation_records(text)'::regprocedure) like '%set status = ''before''%')
--     as "2 전체 삭제가 준비 중으로(true)",
--   (select pg_get_functiondef('public.delete_cycle(integer,text)'::regprocedure) like '%v_status <> ''before''%')
--     as "3 카드 삭제는 준비 중만(true)",
--   (select count(*) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--     where n.nspname = 'public' and p.proname = 'clear_cycle_results') as "4 카드별 결과 삭제 함수(false)",
--   (select count(*) from cycles where status = 'cleared') as "5 결과 삭제됨 평가(0)",
--   (select pg_get_constraintdef(oid) like '%cleared%' from pg_constraint where conname = 'cycles_status_check')
--     as "6 상태 규칙에 cleared(false)",
--   (select count(*) from cycle_kpis) = (select count(*) from cycles) * (select count(*) from departments)
--     as "7 부서 KPI 그대로(true)";
