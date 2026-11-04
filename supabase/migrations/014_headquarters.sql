-- 014_headquarters.sql : 본부 (org-v2, 발표 후 합치기)
--
-- 실행 방법: 013 다음에 SQL Editor에서 이 파일 전체를 실행한다. 여러 번 실행해도 안전하다.
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 실행 후 맨 아래 확인 쿼리를 따로 돌려 실제로 바뀌었는지 확인한다. 그다음 90 시연 초기화.
--
-- 바뀌는 것
-- 1) 본부 표(headquarters): 기술영업본부 · 생산기술본부 · 구매자재본부
-- 2) 부서는 1단계 그대로 6개: 기술영업부 · 기술부 · 생산부 · 구매자재부 · 경영기획부 · 안전품질부
--    부서마다 본부 칸(headquarters_id). 경영기획부 · 안전품질부는 본부 없음
--    시연용 옛 이름이 있으면 바꾼다: 영업부 → 기술영업부, 생산 → 생산부 (내부 번호는 그대로라 직원 연결 유지)
-- 3) 직원 표에 본부 칸(headquarters_id): 임원만 쓴다. 비어 있으면 본부 없는 임원
--    (본부 없이 부서만 적힌 임원 = 본부 없는 임원)
-- 4) 평가 관계 규칙: 팀원·팀장의 임원 평가자 = 부서의 본부와 같은 본부 임원
--    (본부 없는 부서는 본부 없는 임원) → 없으면 직급이 가장 높은 임원. 임원 상향은 그 반대 방향
-- 5) 명단 올리기(import_employees): "본부" 칸. 부서·본부 이름이 정확히 일치하지 않으면 오류,
--    팀원·팀장이 적은 본부가 부서의 본부와 다르면 오류
-- 6) 평가 중 조직도 잠금(009)에 본부 칸도 포함
-- 임원 KPI = 그 본부 부서 KPI 평균은 화면 계산(src/lib/scoring.ts)에서 한다. 본부 없는 임원은 자기 부서 KPI

begin;

-- ---------------------------------------------------------------
-- 1) 본부 표
-- ---------------------------------------------------------------
create table if not exists headquarters (
  id         integer primary key,
  name       text not null unique,          -- 본부 이름
  sort_order integer not null
);
comment on table headquarters is '본부 (부서 위 단계. 임원은 본부 소속)';

alter table headquarters enable row level security;
revoke all on headquarters from public, anon;
grant select on public.headquarters to authenticated;
drop policy if exists "본부: 로그인한 사람 읽기" on public.headquarters;
create policy "본부: 로그인한 사람 읽기" on public.headquarters
  for select to authenticated using (true);

insert into headquarters (id, name, sort_order) values
  (1, '기술영업본부', 1), (2, '생산기술본부', 2), (3, '구매자재본부', 3)
on conflict (id) do nothing;


-- ---------------------------------------------------------------
-- 2) 부서: 본부 칸 + 부서 6개
-- ---------------------------------------------------------------
alter table departments add column if not exists headquarters_id integer references headquarters (id);

-- 시연용 옛 이름 (새 이름이 아직 없을 때만)
update departments set name = '기술영업부'
where name = '영업부' and not exists (select 1 from departments where name = '기술영업부');
update departments set name = '생산부'
where name = '생산' and not exists (select 1 from departments where name = '생산부');

-- 부서가 하나도 없으면(새 프로젝트) 넣지 않는다: seed 01이 넣는다
insert into departments (id, name)
select (select coalesce(max(id), 0) from departments) + row_number() over (order by v.ord), v.name
from (values ('기술영업부', 1), ('기술부', 2), ('생산부', 3), ('구매자재부', 4), ('경영기획부', 5), ('안전품질부', 6))
  as v(name, ord)
where not exists (select 1 from departments d where d.name = v.name)
  and exists (select 1 from departments);

update departments d set headquarters_id = h.id
from (values ('기술영업부', '기술영업본부'), ('기술부', '생산기술본부'), ('생산부', '생산기술본부'),
             ('구매자재부', '구매자재본부')) as v(dept, hq)
join headquarters h on h.name = v.hq
where d.name = v.dept and d.headquarters_id is distinct from h.id;


-- ---------------------------------------------------------------
-- 3) 직원: 본부 칸 (임원만)
-- ---------------------------------------------------------------
alter table employees add column if not exists headquarters_id integer references headquarters (id);
comment on column employees.headquarters_id is '본부 (임원만. 비어 있으면 본부 없는 임원)';


-- ---------------------------------------------------------------
-- 4) 평가 관계 규칙 다시 정의 (013): 본부 기준
-- ---------------------------------------------------------------
create or replace function public.rule_relations_base()
returns table (target_id integer, evaluator_id integer, stage text)
language sql stable
set search_path = ''
as $$
  with execs as (   -- 임원 (재직, 평가 불참 직급 아님). 본부 = 직원의 본부 칸 (비어 있으면 본부 없는 임원)
    select x.id, x.headquarters_id, coalesce(p.sort_order, 0) as rank
    from public.employees x
    left join public.positions p on p.name = x.position
    where x.role = 'executive' and x.status = 'active'
      and not coalesce(p.no_evaluation, false)   -- 013: 대표이사·부사장 등 평가 불참 직급은 평가자도 안 함
  ),
  top_exec as (
    select id from execs order by rank desc, id limit 1
  ),
  hq_exec as (   -- 본부마다 한 명 (직급 높은 순 · 내부 번호 작은 순). 본부 없는 임원끼리도 한 묶음 (본부 칸 null)
    select distinct on (headquarters_id) headquarters_id, id
    from execs order by headquarters_id, rank desc, id
  ),
  people as (   -- 팀원·팀장 (재직) + 그 사람을 평가하는 임원
    -- 부서의 본부와 같은 본부 임원 (본부 없는 부서는 본부 없는 임원) → 없으면 직급이 가장 높은 임원
    select t.*, coalesce(h.id, (select id from top_exec)) as exec_id
    from public.employees t
    join public.departments d on d.id = t.department_id
    left join hq_exec h on h.headquarters_id is not distinct from d.headquarters_id
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
-- 5) 명단 반영 다시 정의 (008): 본부 칸, 이름 정확히 일치
--   p_rows 예: [{"employee_no": "900028", "name": "이정호", "department": "생산부", "headquarters": "생산기술본부",
--               "position": "상무", "role": "executive", "job_group": "production", "excluded": false}, ...]
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
  v_dept_hq integer;
  v_hq      integer;
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
      employee_no text, name text, department text, headquarters text, position text,
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
    -- 부서·본부 이름은 정확히 일치해야 한다 (생산팀/생산부처럼 섞인 이름 거부)
    v_dept := null;
    v_dept_hq := null;
    select id, headquarters_id into v_dept, v_dept_hq from public.departments where name = v_row.department;
    if v_dept is null then
      raise exception '%번째 줄: 없는 부서입니다 (%). 부서 이름이 정확히 같아야 합니다.', v_line, v_row.department;
    end if;
    v_hq := null;
    if coalesce(v_row.headquarters, '') <> '' then
      select id into v_hq from public.headquarters where name = v_row.headquarters;
      if v_hq is null then
        raise exception '%번째 줄: 없는 본부입니다 (%). 본부 이름이 정확히 같아야 합니다.', v_line, v_row.headquarters;
      end if;
    end if;
    -- 팀원·팀장의 본부는 부서에서 정해진다: 적었으면 부서의 본부와 같아야 한다
    if v_row.role in ('member', 'leader') and v_hq is not null and v_hq is distinct from v_dept_hq then
      raise exception '%번째 줄: 부서(%)와 본부(%)가 맞지 않습니다.', v_line, v_row.department, v_row.headquarters;
    end if;
    -- 직원 표의 본부 칸은 임원만 쓴다 (비우면 본부 없는 임원)
    if v_row.role is distinct from 'executive' then
      v_hq := null;
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
      insert into public.employees (employee_no, name, department_id, headquarters_id, position, role, job_group, excluded, status)
      values (v_row.employee_no, trim(v_row.name), v_dept, v_hq, trim(v_row.position), v_row.role, v_row.job_group,
              coalesce(v_row.excluded, false), 'active');
      v_new := v_new + 1;
    elsif (v_old.name, v_old.department_id, v_old.headquarters_id, v_old.position, v_old.role, v_old.job_group, v_old.excluded, v_old.status)
          is distinct from
          (trim(v_row.name), v_dept, v_hq, trim(v_row.position), v_row.role, v_row.job_group, coalesce(v_row.excluded, false), 'active') then
      update public.employees
      set name = trim(v_row.name), department_id = v_dept, headquarters_id = v_hq, position = trim(v_row.position),
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

revoke execute on function public.import_employees(jsonb, text[]) from public, anon, authenticated;
grant execute on function public.import_employees(jsonb, text[]) to service_role;


-- ---------------------------------------------------------------
-- 6) 평가 중 조직도 잠금 다시 정의 (009): 본부 칸 포함
-- ---------------------------------------------------------------
create or replace function public.lock_org_in_progress()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.cycles where status = 'in_progress')
     and (new.department_id is distinct from old.department_id
       or new.headquarters_id is distinct from old.headquarters_id
       or new.position      is distinct from old.position
       or new.role          is distinct from old.role
       or new.job_group     is distinct from old.job_group
       or new.excluded      is distinct from old.excluded
       or new.name          is distinct from old.name
       or new.employee_no   is distinct from old.employee_no)
  then
    raise exception '평가 중에는 직원의 부서·본부·직급·역할·직군·평가 제외를 바꿀 수 없습니다 (퇴사 처리만 가능).';
  end if;
  return new;
end;
$$;

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다
-- ---------------------------------------------------------------
-- select
--   (select string_agg(name, ', ' order by sort_order) from public.headquarters) as "1 본부(3)",
--   (select string_agg(d.name || coalesce('(' || h.name || ')', ''), ', ' order by d.id)
--      from public.departments d left join public.headquarters h on h.id = d.headquarters_id) as "2 부서(본부)",
--   (select string_agg(e.employee_no || ' ' || e.name || ' ' || coalesce(h.name, '본부 없음'), ', ' order by e.employee_no)
--      from public.employees e left join public.headquarters h on h.id = e.headquarters_id
--     where e.role = 'executive') as "3 임원 본부",
--   (select pg_get_functiondef('public.rule_relations_base'::regproc) like '%hq_exec%') as "4 규칙",
--   (select pg_get_functiondef('public.import_employees(jsonb,text[])'::regprocedure) like '%headquarters%') as "5 명단 반영",
--   (select pg_get_functiondef('public.lock_org_in_progress'::regproc) like '%headquarters_id%') as "6 잠금";
-- 기대: 기술영업본부, 생산기술본부, 구매자재본부 /
--       경영기획부, 기술영업부(기술영업본부), 생산부(생산기술본부), 기술부(생산기술본부), 구매자재부(구매자재본부), 안전품질부 /
--       (90 실행 후) 900028 이정호 생산기술본부, 900029 윤재석 본부 없음, 900030 백승민 기술영업본부 / true / true / true
