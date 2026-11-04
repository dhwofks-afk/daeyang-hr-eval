-- 2026-11-04_remove_test_employee.sql : 시험용 직원 "시험직원" 1명 지우기 (한 번만 실행하는 정리용)
--
-- migrations에 넣지 않는다: 표 구조가 아니라 실제 서버의 데이터 한 명을 지우는 일이라,
-- 새 환경을 만들 때 다시 실행되면 안 된다.
--
-- 실행 방법 (실행: 오재란, SQL Editor)
--   1) 0번 "지울 대상 미리 보기"만 먼저 실행해서 숫자를 확인한다
--      (11/4 읽어 본 값: 직원 1 / 평가 건 5 (대상 3·평가자 3, 자기평가 1건은 둘 다) / 그중 제출 0 /
--       답 0 / 반려 기록 0 / 만족도 제출 기록 0 / 자기관찰 0 / 보정 0 / 확정 결과 1 / 로그인 계정 1)
--   2) 숫자가 같으면 1번 "지우기"를 실행한다 (begin ~ commit 전체)
--   3) 2번 확인 쿼리로 결과를 확인한다
--
-- 고르는 기준: 사번 999999 + 이름 "시험직원"이 모두 맞는 직원. 정확히 1명이 아니면 아무것도 지우지 않고 멈춘다.
-- 평가 건은 회차가 "평가 전"일 때만 지울 수 있다 (잠금 장치 cases_lock). 평가를 시작한 뒤에 실행하면 오류가 나고 아무것도 지워지지 않는다.
-- 만족도 내용(satisfaction)·건의(suggestions)는 작성자를 저장하지 않아 누가 썼는지 알 수 없으므로 지우지 않는다.


-- ---------------------------------------------------------------
-- 0) 지울 대상 미리 보기 (읽기만 함)
-- ---------------------------------------------------------------
with target as (
  select id, auth_user_id from public.employees
  where employee_no = '999999' and name = '시험직원'
),
target_cases as (
  select c.id, c.status from public.cases c
  where c.target_id in (select id from target) or c.evaluator_id in (select id from target)
)
select
  (select count(*) from target)                                                         as "직원(1)",
  (select count(*) from target_cases)                                                   as "평가 건(5)",
  (select count(*) from target_cases where status = 'submitted')                        as "그중 제출(0)",
  (select count(*) from public.answers where case_id in (select id from target_cases))  as "답(0)",
  (select count(*) from public.return_logs where case_id in (select id from target_cases)) as "반려 기록(0)",
  (select count(*) from public.satisfaction_done where employee_id in (select id from target)) as "만족도 제출 기록(0)",
  (select count(*) from public.self_observations where employee_id in (select id from target)) as "자기관찰(0)",
  (select count(*) from public.adjustments where employee_id in (select id from target)) as "보정(0)",
  (select count(*) from public.final_results where employee_id in (select id from target)) as "확정 결과(1)",
  (select count(*) from auth.users where id in (select auth_user_id from target))        as "로그인 계정(1)";


-- ---------------------------------------------------------------
-- 1) 지우기: 전체를 begin/commit으로 묶는다. 중간에 오류가 나면 아무것도 지워지지 않는다
-- ---------------------------------------------------------------
begin;

do $$
declare
  v_matches integer;
  v_id      integer;
  v_auth    uuid;
  v_case_ids integer[];
  v_count   integer;
begin
  -- 정확히 1명인지 확인
  select count(*) into v_matches from public.employees
  where employee_no = '999999' and name = '시험직원';
  if v_matches <> 1 then
    raise exception '사번 999999 + 이름 시험직원인 직원이 %명입니다. 1명일 때만 지웁니다.', v_matches;
  end if;

  select id, auth_user_id into v_id, v_auth from public.employees
  where employee_no = '999999' and name = '시험직원';

  -- 그 직원이 평가 대상이거나 평가자인 평가 건
  select coalesce(array_agg(id), '{}') into v_case_ids from public.cases
  where target_id = v_id or evaluator_id = v_id;

  -- 평가 건에 딸린 기록부터 (반려 기록은 자동으로 같이 지워지지 않는다)
  delete from public.return_logs where case_id = any (v_case_ids);
  delete from public.answers where case_id = any (v_case_ids);
  delete from public.cases where id = any (v_case_ids);
  get diagnostics v_count = row_count;
  if v_count <> cardinality(v_case_ids) then
    raise exception '평가 건을 %건 중 %건만 지웠습니다. 되돌립니다.', cardinality(v_case_ids), v_count;
  end if;

  -- 그 직원에게 연결된 기록
  delete from public.satisfaction_done where employee_id = v_id;
  delete from public.self_observations where employee_id = v_id;
  delete from public.adjustments where employee_id = v_id;
  delete from public.final_results where employee_id = v_id;

  -- 직원
  delete from public.employees where id = v_id;
  get diagnostics v_count = row_count;
  if v_count <> 1 then
    raise exception '직원을 지우지 못했습니다. 되돌립니다.';
  end if;

  -- 로그인 계정 (연결된 로그인 기록은 Supabase가 함께 지운다)
  if v_auth is not null then
    delete from auth.users where id = v_auth;
  end if;

  raise notice '지웠습니다: 직원 1명, 평가 건 %건', cardinality(v_case_ids);
end;
$$;

commit;


-- ---------------------------------------------------------------
-- 2) 확인 쿼리 (읽기만 함). 지우기를 실행한 뒤에 따로 돌린다
-- ---------------------------------------------------------------
-- select
--   (select count(*) from public.employees)                                         as "직원(30)",
--   (select count(*) from public.cases where cycle_id = 1)                          as "평가 건(129)",
--   (select count(*) from public.cases where cycle_id = 1 and status = 'submitted') as "그중 제출(121)",
--   (select count(*) from public.employees where employee_no = '999999' or name = '시험직원') as "시험직원 남음(0)",
--   (select count(*) from public.cases c
--      where not exists (select 1 from public.employees e where e.id = c.target_id)
--         or not exists (select 1 from public.employees e where e.id = c.evaluator_id)) as "직원 없는 평가 건(0)";
