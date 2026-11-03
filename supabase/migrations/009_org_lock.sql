-- 009_org_lock.sql : 평가 중 조직도 잠금 (docs/13-조직도.md, 11/3 결정)
--
-- 실행 방법: 011 다음에 SQL Editor에서 이 파일 전체를 실행한다. (번호는 010에서 비워 둔 009를 쓴다)
-- 여러 번 실행해도 안전하다 (함수는 다시 정의하고, 트리거는 지우고 다시 만든다).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 실행 후 맨 아래 확인 쿼리로 함수·트리거가 실제로 생겼는지 반드시 확인한다.
--
-- 바뀌는 것
-- - "평가 중"인 회차가 있으면 직원 표의 부서·직급·역할·직군·평가 제외·이름·사번을 바꿀 수 없다 (관리자도)
-- - 그래도 되는 것: 재직 상태(퇴사 처리·재직으로 되돌리기), 로그인 계정 연결(계정 만들기 스크립트가 씀),
--   새 직원 추가(명단 올리기 008). 직원 삭제는 원래 권한이 없다 (002)
-- - 참고: 평가 중에 명단 올리기(008 import_employees)로 기존 직원의 부서·직급 등을 바꾸면 이 잠금에 걸려
--   명단 반영 전체가 취소된다 (import_employees는 한 거래). 값이 같으면 걸리지 않는다

begin;

create or replace function public.lock_org_in_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.cycles where status = 'in_progress')
     and (new.department_id is distinct from old.department_id
       or new.position      is distinct from old.position
       or new.role          is distinct from old.role
       or new.job_group     is distinct from old.job_group
       or new.excluded      is distinct from old.excluded
       or new.name          is distinct from old.name
       or new.employee_no   is distinct from old.employee_no)
  then
    raise exception '평가 중에는 직원의 부서·직급·역할·직군·평가 제외를 바꿀 수 없습니다 (퇴사 처리만 가능).';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_lock_org on public.employees;
create trigger employees_lock_org
  before update on public.employees
  for each row execute function public.lock_org_in_progress();

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다
-- ---------------------------------------------------------------
-- select
--   (select count(*) from pg_proc where proname = 'lock_org_in_progress') as "1 잠금 함수(1)",
--   (select count(*) from pg_trigger where tgname = 'employees_lock_org' and not tgisinternal) as "2 트리거(1)",
--   (select pg_get_triggerdef(oid) from pg_trigger where tgname = 'employees_lock_org') as "3 트리거 정의",
--   (select string_agg(id || ':' || status, ', ' order by id) from public.cycles) as "4 회차 상태";
-- 기대: 1 / 1 / "... BEFORE UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION lock_org_in_progress()" / 지금 회차 상태
-- 잠금이 실제로 걸리는지는 회차가 "평가 중"일 때 화면에서 부서를 바꿔 저장해 보면 된다 (거부되면 정상, 퇴사 처리는 됨)
