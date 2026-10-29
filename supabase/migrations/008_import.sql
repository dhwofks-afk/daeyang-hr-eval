-- 008_import.sql : 데이터 관리 — 직원 명단 반영, 직급 표, 회차 끝내기 (docs/11-데이터관리.md)
--
-- 실행 방법: 007 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- 실행 후 확인 쿼리로 표·함수가 실제로 생겼는지 반드시 확인한다.
--
-- 명단 반영은 두 단계로 나눈다.
-- 1) 직원 추가·변경·퇴사: 이 파일의 import_employees (한 거래로 처리 — 하나라도 틀리면 아무것도 바뀌지 않음)
-- 2) 새 직원의 로그인 계정 만들기: Edge Function import-employees (관리용 열쇠가 필요해서 Supabase 안에서 처리)
-- import_employees는 관리용 열쇠(service_role)로만 부를 수 있다. 화면은 Edge Function을 부른다.


-- ---------------------------------------------------------------
-- 직급 표: 직급 목록은 코드에 고정하지 않고 데이터로 둔다 (CLAUDE.md 6번)
-- 명단 반영 때 "잘못된 직급"을 가려내는 데 쓴다
-- ---------------------------------------------------------------
create table positions (
  name       text primary key,             -- 직급 이름
  sort_order integer not null unique       -- 낮은 직급 → 높은 직급
);
comment on table positions is '직급';

insert into positions (name, sort_order) values
  ('사원', 1), ('주임', 2), ('대리', 3), ('과장', 4), ('차장', 5),
  ('부장', 6), ('이사', 7), ('상무', 8), ('부사장', 9), ('회장', 10);


-- ---------------------------------------------------------------
-- 명단 반영 기록: 언제, 어느 회차를 앞두고, 몇 명이 바뀌었는지
-- 새 해 순서 화면이 "새 회차에 명단을 반영했는지"를 이 표로 판단한다
-- ---------------------------------------------------------------
create table import_logs (
  id             integer generated always as identity primary key,
  cycle_id       integer references cycles (id),   -- 반영할 때 "평가 전"이던 가장 최근 회차 (없으면 비움)
  new_count      integer not null,                 -- 새 직원
  changed_count  integer not null,                 -- 바뀜
  retired_count  integer not null,                 -- 퇴사 처리
  account_failed integer,                          -- 계정 생성 실패 (Edge Function이 채움)
  imported_at    timestamptz not null default now()
);
comment on table import_logs is '명단 반영 기록';


-- ---------------------------------------------------------------
-- 잠그기 + 권한: 직급은 로그인한 사람 읽기, 명단 반영 기록은 관리자 읽기. 쓰기는 함수로만
-- ---------------------------------------------------------------
alter table positions   enable row level security;
alter table import_logs enable row level security;

revoke all on positions, import_logs from public, anon;
grant select on public.positions   to authenticated;
grant select on public.import_logs to authenticated;

create policy "직급: 로그인한 사람 읽기" on public.positions
  for select to authenticated using (true);
create policy "명단 반영 기록: 관리자 읽기" on public.import_logs
  for select to authenticated using (public.is_admin());


-- ---------------------------------------------------------------
-- 직원 명단 반영 (관리용 열쇠로만). Edge Function이 부른다
--   p_rows 예: [{"employee_no": "900001", "name": "홍길동", "department": "생산", "position": "사원",
--               "role": "member", "job_group": "production", "excluded": false}, ...]
--   p_retire: 퇴사 처리할 사번 목록 (화면에서 체크한 퇴사 후보만)
-- 거부: 평가 중인 회차가 있음 / 사번이 숫자가 아님 / 사번 중복 / 빈 이름 / 없는 부서 / 잘못된 직급·역할·직군 /
--       퇴사 대상이 파일에 있거나 재직이 아님
-- 돌려주는 값: {"log_id", "new", "changed", "retired", "need_account": [{"id", "employee_no"}]}
--   need_account = 재직인데 로그인 계정이 아직 없는 직원 전부 (지난번 실패분도 다시 만든다)
-- ---------------------------------------------------------------
create or replace function public.import_employees(p_rows jsonb, p_retire text[])
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_row     record;
  v_line    integer := 0;
  v_dept    integer;
  v_old     public.employees%rowtype;
  v_new     integer := 0;
  v_changed integer := 0;
  v_retired integer := 0;
  v_no      text;
  v_cycle   integer;
  v_log     integer;
  v_need    jsonb;
begin
  if exists (select 1 from public.cycles where status = 'in_progress') then
    raise exception '평가 중인 회차가 있어 명단을 올릴 수 없습니다.';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception '올릴 명단이 없습니다.';
  end if;

  -- 사번 중복 (파일 안)
  select r ->> 'employee_no' into v_no
  from jsonb_array_elements(p_rows) r
  group by r ->> 'employee_no' having count(*) > 1 limit 1;
  if v_no is not null then
    raise exception '사번 %이(가) 명단에 두 번 이상 있습니다.', v_no;
  end if;

  for v_row in
    select * from jsonb_to_recordset(p_rows) as x (
      employee_no text, name text, department text, position text,
      role text, job_group text, excluded boolean
    )
  loop
    v_line := v_line + 1;
    if v_row.employee_no is null or v_row.employee_no !~ '^[0-9]+$' then
      raise exception '%번째 줄: 사번은 숫자만 쓸 수 있습니다.', v_line;
    end if;
    if v_row.name is null or length(trim(v_row.name)) = 0 then
      raise exception '%번째 줄: 이름이 비어 있습니다.', v_line;
    end if;
    select id into v_dept from public.departments where name = trim(v_row.department);
    if v_dept is null then
      raise exception '%번째 줄: 없는 부서입니다 (%).', v_line, v_row.department;
    end if;
    if not exists (select 1 from public.positions where name = trim(v_row.position)) then
      raise exception '%번째 줄: 잘못된 직급입니다 (%).', v_line, v_row.position;
    end if;
    if v_row.role is null or v_row.role not in ('member', 'leader', 'executive') then
      raise exception '%번째 줄: 잘못된 역할입니다.', v_line;
    end if;
    if v_row.job_group is null or v_row.job_group not in ('production', 'office') then
      raise exception '%번째 줄: 잘못된 직군입니다.', v_line;
    end if;

    select * into v_old from public.employees where employee_no = v_row.employee_no;
    if not found then
      insert into public.employees (employee_no, name, department_id, position, role, job_group, excluded, status)
      values (v_row.employee_no, trim(v_row.name), v_dept, trim(v_row.position), v_row.role, v_row.job_group,
              coalesce(v_row.excluded, false), 'active');
      v_new := v_new + 1;
    elsif (v_old.name, v_old.department_id, v_old.position, v_old.role, v_old.job_group, v_old.excluded, v_old.status)
          is distinct from
          (trim(v_row.name), v_dept, trim(v_row.position), v_row.role, v_row.job_group, coalesce(v_row.excluded, false), 'active') then
      update public.employees
      set name = trim(v_row.name), department_id = v_dept, position = trim(v_row.position),
          role = v_row.role, job_group = v_row.job_group, excluded = coalesce(v_row.excluded, false),
          status = 'active'                     -- 파일에 있으면 재직 (퇴사했던 사람이 돌아온 경우 포함)
      where id = v_old.id;
      v_changed := v_changed + 1;
    end if;
  end loop;

  -- 퇴사 처리: 체크한 퇴사 후보만. 파일에 있는 사람이나 이미 퇴사한 사람은 거부
  foreach v_no in array coalesce(p_retire, '{}') loop
    if exists (select 1 from jsonb_array_elements(p_rows) r where r ->> 'employee_no' = v_no) then
      raise exception '사번 %은(는) 명단에 있어 퇴사 처리할 수 없습니다.', v_no;
    end if;
    update public.employees set status = 'retired' where employee_no = v_no and status = 'active';
    if not found then
      raise exception '사번 %은(는) 재직 중인 직원이 아닙니다.', v_no;
    end if;
    v_retired := v_retired + 1;
  end loop;

  select max(id) into v_cycle from public.cycles where status = 'before';
  insert into public.import_logs (cycle_id, new_count, changed_count, retired_count)
  values (v_cycle, v_new, v_changed, v_retired)
  returning id into v_log;

  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'employee_no', e.employee_no) order by e.id), '[]')
    into v_need
  from public.employees e
  where e.status = 'active' and e.auth_user_id is null;

  return jsonb_build_object('log_id', v_log, 'new', v_new, 'changed', v_changed,
                            'retired', v_retired, 'need_account', v_need);
end;
$$;


-- 계정 생성 실패 수 기록 (관리용 열쇠로만). Edge Function이 계정을 다 만든 뒤 부른다
create or replace function public.set_import_account_failed(p_log_id integer, p_failed integer)
returns void
language sql security definer
set search_path = ''
as $$
  update public.import_logs set account_failed = p_failed where id = p_log_id
$$;


-- ---------------------------------------------------------------
-- 회차 끝내기 (관리자): "평가 중" → "평가 완료". 새 해 순서의 첫 단계
-- ---------------------------------------------------------------
create or replace function public.finish_cycle(p_cycle_id integer)
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
    raise exception '회차를 찾을 수 없습니다.';
  end if;
  if v_status <> 'in_progress' then
    raise exception '"평가 중" 회차만 끝낼 수 있습니다.';
  end if;
  update public.cycles set status = 'done' where id = p_cycle_id;
end;
$$;


-- ---------------------------------------------------------------
-- 함수 호출 권한
-- - 명단 반영 두 함수: 관리용 열쇠(service_role)만. 로그인한 사람·로그인 전 모두 못 부름
-- - 회차 끝내기: 로그인한 사람 (관리자 확인은 함수 안에서)
-- - 관리용 열쇠가 import_logs 표를 직접 읽고 쓸 일은 없다 (함수가 처리)
-- ---------------------------------------------------------------
revoke execute on function public.import_employees(jsonb, text[]) from public, anon, authenticated;
revoke execute on function public.set_import_account_failed(integer, integer) from public, anon, authenticated;
grant execute on function public.import_employees(jsonb, text[]) to service_role;
grant execute on function public.set_import_account_failed(integer, integer) to service_role;

revoke execute on function public.finish_cycle(integer) from public, anon;
grant execute on function public.finish_cycle(integer) to authenticated;
