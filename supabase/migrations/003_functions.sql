-- 003_functions.sql : 서버 함수와 잠금 장치 (docs/05-서버기반.md 4·5번)
--
-- 실행 방법: 002_policies.sql 다음에 SQL Editor에서 이 파일 전체를 실행한다.
-- 서버 함수는 로그인한 사람만 부를 수 있다. 어떤 함수도 사번을 돌려주지 않는다.


-- ---------------------------------------------------------------
-- 내 정보: 로그인 후 역할에 맞는 첫 페이지로 보내는 데 쓴다
-- ---------------------------------------------------------------
create or replace function public.my_profile()
returns table (
  name       text,     -- 이름
  department text,     -- 부서명
  "position" text,     -- 직급
  role       text,     -- member / leader / executive / admin
  is_admin   boolean   -- 관리자 여부
)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if public.is_admin() then
    return query select '관리자'::text, null::text, null::text, 'admin'::text, true;
    return;
  end if;

  return query
    select e.name, d.name, e."position", e.role, false
    from public.employees e
    join public.departments d on d.id = e.department_id
    where e.id = public.my_employee_id();
end;
$$;


-- ---------------------------------------------------------------
-- 이름 확인: 로그인 2단계. 사번으로 로그인한 계정의 이름이 입력한 이름과 같은지
-- (다르면 화면이 바로 로그아웃하고 "이름 또는 사번이 맞지 않습니다")
-- ---------------------------------------------------------------
create or replace function public.check_login_name(p_name text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.employees e
    where e.auth_user_id = auth.uid()
      and e.status = 'active'
      and e.name = trim(p_name)
  )
$$;


-- ---------------------------------------------------------------
-- 내 평가 대상 목록 (사번 없음). 내가 평가자인 평가 건의 대상들이다.
--   팀원: 나 + 상향 평가할 내 팀장 / 팀장: 나 + 내 팀원들 / 임원: 나 + 배정된 평가 대상
-- previous_stage_done: 팀장·임원 단계에서, 대상의 "전 단계"가 제출됐는지
--   팀장 평가 → 대상의 자기평가 / 임원 평가 → 팀원은 팀장 평가, 팀장은 자기평가. 그 밖에는 null
-- ---------------------------------------------------------------
create or replace function public.my_targets(p_cycle_id integer)
returns table (
  employee_id         integer,  -- 대상의 내부 번호
  name                text,     -- 이름
  department          text,     -- 부서명
  "position"          text,     -- 직급
  my_stage            text,     -- 내가 이 사람을 평가하는 단계
  my_case_id          integer,  -- 내 평가 건 번호
  my_case_status      text,     -- 내 평가 건 상태
  previous_stage_done boolean   -- 전 단계 제출 여부
)
language sql stable security definer
set search_path = ''
as $$
  select
    t.id,
    t.name,
    d.name,
    t."position",
    c.stage,
    c.id,
    c.status,
    case
      when c.stage in ('leader', 'executive') then exists (
        select 1 from public.cases p
        where p.cycle_id = c.cycle_id
          and p.target_id = t.id
          and p.status = 'submitted'
          and p.stage = case
                          when c.stage = 'executive' and t.role = 'member' then 'leader'
                          else 'self'
                        end
      )
      else null
    end
  from public.cases c
  join public.employees t on t.id = c.target_id
  join public.departments d on d.id = t.department_id
  where c.cycle_id = p_cycle_id
    and c.evaluator_id = public.my_employee_id()
  order by (c.stage = 'self') desc, d.name, t.name
$$;


-- ---------------------------------------------------------------
-- 내 결과 가져오기
-- 1) 결과가 공개됐는지 확인 → 아니면 null
-- 2) 로그인한 본인 줄만
-- 3) 공개 범위(cycles.public_scope)에 체크된 칸만 돌려준다
--    (공개 범위는 칸 단위라 권한 규칙(줄 단위)으로 못 숨겨서 함수로 처리)
-- 공개 범위에 쓸 수 있는 칸 이름:
--   department_name, score_self, score_leader, score_executive, score_upward,
--   weighted, kpi_applied, final, grade
-- ---------------------------------------------------------------
create or replace function public.get_my_result(p_cycle_id integer)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_cycle  public.cycles%rowtype;
  v_result jsonb;
begin
  select * into v_cycle from public.cycles where id = p_cycle_id;
  if not found or not v_cycle.result_published then
    return null;
  end if;

  select to_jsonb(r) into v_result
  from public.final_results r
  where r.cycle_id = p_cycle_id
    and r.employee_id = public.my_employee_id();
  if v_result is null then
    return null;
  end if;

  -- 공개 범위에 체크된 칸만 남긴다 (+ 공개 시각)
  return (
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(v_result)
    where key = any (v_cycle.public_scope)
      and key in ('department_name', 'score_self', 'score_leader', 'score_executive',
                  'score_upward', 'weighted', 'kpi_applied', 'final', 'grade')
  ) || jsonb_build_object('published_at', v_result -> 'published_at');
end;
$$;


-- ---------------------------------------------------------------
-- 잠금 장치 1: 결과가 공개된 회차는 KPI·가중치·등급 비율을 바꿀 수 없다
-- ---------------------------------------------------------------
create or replace function public.lock_published_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.result_published and (
       new.weight_member_self      is distinct from old.weight_member_self
    or new.weight_member_leader    is distinct from old.weight_member_leader
    or new.weight_member_executive is distinct from old.weight_member_executive
    or new.weight_leader_self      is distinct from old.weight_leader_self
    or new.weight_leader_executive is distinct from old.weight_leader_executive
    or new.weight_leader_upward    is distinct from old.weight_leader_upward
    or new.kpi_method              is distinct from old.kpi_method
    or new.kpi_base                is distinct from old.kpi_base
    or new.kpi_factor              is distinct from old.kpi_factor
    or new.grade_a                 is distinct from old.grade_a
    or new.grade_b                 is distinct from old.grade_b
    or new.grade_c                 is distinct from old.grade_c
    or new.grade_d                 is distinct from old.grade_d
    or new.result_published        is distinct from old.result_published
  ) then
    raise exception '결과가 공개된 회차는 점수 설정을 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger cycles_lock_published
  before update on public.cycles
  for each row execute function public.lock_published_cycle();


-- ---------------------------------------------------------------
-- 잠금 장치 2: 가장 최근 회차가 공개됐으면 부서 KPI를 바꿀 수 없다
-- (부서 KPI는 회차마다 따로 있지 않아서 "가장 최근 회차" 기준으로 막는다)
-- ---------------------------------------------------------------
create or replace function public.lock_department_kpi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.kpi is distinct from old.kpi and exists (
    select 1 from public.cycles c
    where c.id = (select max(id) from public.cycles) and c.result_published
  ) then
    raise exception '결과가 공개된 뒤에는 부서 KPI를 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;

create trigger departments_lock_kpi
  before update on public.departments
  for each row execute function public.lock_department_kpi();


-- ---------------------------------------------------------------
-- 잠금 장치 3: 보정 기록
-- - 공개된 회차에는 보정을 추가할 수 없다
-- - 보정한 사람·시각은 화면이 보낸 값을 믿지 않고 서버가 채운다 (관리자 1명이라 "관리자")
-- ---------------------------------------------------------------
create or replace function public.prepare_adjustment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.cycles c where c.id = new.cycle_id and c.result_published
  ) then
    raise exception '결과가 공개된 회차에는 보정을 추가할 수 없습니다.';
  end if;
  new.adjusted_by := '관리자';
  new.adjusted_at := now();
  return new;
end;
$$;

create trigger adjustments_prepare
  before insert on public.adjustments
  for each row execute function public.prepare_adjustment();


-- ---------------------------------------------------------------
-- 함수 호출 권한: 로그인한 사람만 (로그인 전·누구나 호출 막음)
-- 잠금 장치 함수는 트리거 전용이라 아무에게도 호출 권한을 주지 않는다
-- ---------------------------------------------------------------
revoke execute on function public.my_profile() from public, anon;
revoke execute on function public.check_login_name(text) from public, anon;
revoke execute on function public.my_targets(integer) from public, anon;
revoke execute on function public.get_my_result(integer) from public, anon;
revoke execute on function public.lock_published_cycle() from public, anon, authenticated;
revoke execute on function public.lock_department_kpi() from public, anon, authenticated;
revoke execute on function public.prepare_adjustment() from public, anon, authenticated;

grant execute on function public.my_profile() to authenticated;
grant execute on function public.check_login_name(text) to authenticated;
grant execute on function public.my_targets(integer) to authenticated;
grant execute on function public.get_my_result(integer) to authenticated;
