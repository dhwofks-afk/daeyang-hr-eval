-- 015_remove_job_group.sql : 직군(생산직·관리직) 없애기 · 평가표 3개(팀원·팀장·상향)로 통합 (11/4 피드백)
--
-- ⚠️ 015 실행 직후 90 실행 필수 (supabase/seed/90_demo_reset.sql).
--    지워지는 옛 문항의 답(시연 데이터)이 함께 지워지므로, 90으로 시연 답을 새 문항에 다시 넣어야 한다.
--
-- 실행 방법: 014 다음에 SQL Editor에서 이 파일 전체를 실행한다 (실행: 오재란).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 여러 번 실행해도 안전하다 (이미 바뀌었으면 건너뛴다). 실행 후 맨 아래 확인 쿼리를 따로 돌린다.
-- 015 다음에는 013을 다시 실행하지 않는다 (013은 옛 문항 세트 이름을 쓴다).
--
-- 바뀌는 것
-- 1) 문항 세트: office_member·production_member → member / office_leader·production_leader → leader / upward 그대로
--    - "평가 전" 회차만 바꾼다: 옛 팀원·팀장 문항(과 그 답)을 지우고 새 팀원 평가표(16문항)·팀장 평가표(5문항)를 넣는다
--    - 팀원 평가표 = 두 직군 공통 문항 + 직무능력(두 문구를 하나로 합침). 업무성과 35(본인서술형) · 능력 20 · 근무태도 20 · 보안·규정 준수 10 · 조직문화 15
--    - 평가가 시작된 회차(평가 중·평가 완료)에 옛 문항 세트가 있으면 문항이 잠겨 있어 바꿀 수 없으므로, 오류를 내고 아무것도 바꾸지 않는다
-- 2) 문항 세트 이름 규칙: member / leader / upward 만
-- 3) my_case_details(012): 문항 세트를 대상 역할로 정한다 (상향·임원 상향 = upward, 팀장 대상 = leader, 나머지 = member)
-- 4) import_employees(014)·평가 중 조직도 잠금(014): 직군 없이 다시 정의
-- 5) 직원 표의 직군 칸(job_group) 삭제

begin;

-- ---------------------------------------------------------------
-- 1) 평가가 시작된 회차에 옛 문항 세트가 있으면 멈춘다
-- ---------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from public.questions q
    join public.cycles c on c.id = q.cycle_id
    where c.status <> 'before'
      and q.question_set in ('office_member', 'production_member', 'office_leader', 'production_leader')
  ) then
    raise exception '평가가 시작된 회차에 직군별 문항이 있어 바꿀 수 없습니다. 관리자에게 문의하세요.';
  end if;
end;
$$;


-- ---------------------------------------------------------------
-- 2) 문항 세트 이름 규칙: 옛 규칙(정의에 question_set이 들어간 검사 규칙)을 지우고, 옛 이름도 잠깐 허용하는 규칙으로
--    (3번에서 옛 문항을 지운 뒤 맨 끝에 새 이름만 허용하는 규칙으로 바꾼다)
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.questions'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%question_set%'
  loop
    execute format('alter table public.questions drop constraint %I', r.conname);
  end loop;
end;
$$;


-- ---------------------------------------------------------------
-- 3) "평가 전" 회차: 옛 팀원·팀장 문항과 그 답을 지우고 새 평가표를 넣는다 (이미 새 평가표면 건너뛴다)
-- ---------------------------------------------------------------
do $$
declare
  v_cycle record;
begin
  for v_cycle in
    select c.id from public.cycles c
    where c.status = 'before'
      and exists (
        select 1 from public.questions q
        where q.cycle_id = c.id
          and q.question_set in ('office_member', 'production_member', 'office_leader', 'production_leader')
      )
  loop
    delete from public.answers a
    using public.questions q
    where a.question_id = q.id and q.cycle_id = v_cycle.id
      and q.question_set in ('office_member', 'production_member', 'office_leader', 'production_leader');
    delete from public.questions
    where cycle_id = v_cycle.id
      and question_set in ('office_member', 'production_member', 'office_leader', 'production_leader');

    -- 팀원 평가표: 16문항, 배점 합 100
    insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order) values
    (v_cycle.id, 'member', '업무성과', '본인서술형', 35, '본인의 주요 활동 및 성과 기재', 'essay', 1),
    (v_cycle.id, 'member', '능력', '직무능력', 5, '직무를 원활하게 수행할 수 있는 지식 또는 기능을 보유하고 있다', 'choice', 2),
    (v_cycle.id, 'member', '능력', '직무능력', 5, '직무능력을 향상시키기 위해 적극적으로 노력한다', 'choice', 3),
    (v_cycle.id, 'member', '능력', '직무능력', 5, '직무를 익히는 속도가 빠르고 직무 능력이 뛰어나다', 'choice', 4),
    (v_cycle.id, 'member', '능력', '소통능력', 5, '의사소통 능력이 뛰어나고 상대방을 설득하는 능력이 있다', 'choice', 5),
    (v_cycle.id, 'member', '능력', '소통능력', 5, '혼자서 일을 처리하기 보다는 동료들과 협업하여 보다 효율적으로 일을 처리하려 한다', 'choice', 6),
    (v_cycle.id, 'member', '능력', '판단능력', 5, '자신의 직무를 정확하게 파악하고 실행한다', 'choice', 7),
    (v_cycle.id, 'member', '능력', '판단능력', 5, '회사의 방향과 팀의 목표 등을 정확하게 이해하고 수행한다', 'choice', 8),
    (v_cycle.id, 'member', '능력', '판단능력', 5, '위기상황에서 위기관리 및 대처 능력이 있다', 'choice', 9),
    (v_cycle.id, 'member', '능력', '기타', 5, '중요한 사항들을 잘 기억하고 관리할 줄 아는 능력이 있다', 'choice', 10),
    (v_cycle.id, 'member', '근무태도', '근무태도', 20, '보고 없이 또는 불분명한 사유로 지각, 조퇴, 외출, 결근 등을 하지 않는다', 'choice', 11),
    (v_cycle.id, 'member', '근무태도', '근무태도', 20, '보고없이 근무지를 무단이탈하여 업무에 지장을 주지 않는다', 'choice', 12),
    (v_cycle.id, 'member', '근무태도', '근무태도', 20, '업무 시간에 개인적인 대화, 메신저, 게임, 동영상 시청 등을 하지 않으며 업무 집중도가 높다', 'choice', 13),
    (v_cycle.id, 'member', '보안·규정 준수', '보안·규정 준수', 10, '대외비 자료가 유출되지 않도록 주의를 기울인다', 'choice', 14),
    (v_cycle.id, 'member', '보안·규정 준수', '보안·규정 준수', 10, '회사와 부서의 규정, 규칙을 준수한다', 'choice', 15),
    (v_cycle.id, 'member', '조직문화', '조직문화', 15, '개인과 부서의 이익만 추구하지 않고 회사 전체의 이익을 위하여 매사에 적극적으로 행동한다', 'choice', 16);

    -- 팀장 평가표: 5문항, 배점 합 100 (두 직군 평가표가 같았다)
    insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order) values
    (v_cycle.id, 'leader', '업무성과', '부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적', 30, '부서 목표 달성도, 업무 추진실적, 성과 창출 및 개선실적', 'choice', 1),
    (v_cycle.id, 'leader', '리더십 및 조직관리', '업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력', 25, '업무분장, 구성원 지도·육성, 갈등 조정, 조직 운영능력', 'choice', 2),
    (v_cycle.id, 'leader', '직무역량 및 의사결정', '직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성', 20, '직무 전문성, 문제해결 능력, 상황 판단 및 의사결정의 적절성', 'choice', 3),
    (v_cycle.id, 'leader', '책임감 및 규정준수', '관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응', 15, '관리자로서의 책임 이행, 회사규정 준수, 리스크 예방 및 대응', 'choice', 4),
    (v_cycle.id, 'leader', '협업 및 조직기여', '타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여', 10, '타 부서 협력, 경영방침 이행, 조직 전체의 목표 달성 기여', 'choice', 5);
  end loop;
end;
$$;

alter table public.questions add constraint questions_question_set_check
  check (question_set in ('member', 'leader', 'upward'));


-- ---------------------------------------------------------------
-- 4) 내 평가 건의 문항 세트·대상 역할 다시 정의 (012): 직군 없이 대상 역할로
-- ---------------------------------------------------------------
create or replace function public.my_case_details(p_cycle_id integer)
returns table (
  case_id      integer,  -- 내 평가 건 번호
  question_set text,     -- 문항 세트
  target_role  text      -- 대상 역할 (서술형 화면을 정할 때 씀)
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.id,
    case
      when c.stage in ('upward', 'exec_upward') then 'upward'
      when t.role = 'leader' then 'leader'
      else 'member'
    end,
    t.role
  from public.cases c
  join public.employees t on t.id = c.target_id
  where c.cycle_id = p_cycle_id
    and c.evaluator_id = public.my_employee_id()
$$;

revoke execute on function public.my_case_details(integer) from public, anon;
grant execute on function public.my_case_details(integer) to authenticated;


-- ---------------------------------------------------------------
-- 5) 명단 반영 다시 정의 (014): 직군 칸 없음 (예전 명단에 job_group이 있어도 읽지 않는다)
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
      role text, excluded boolean
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

    select * into v_old from public.employees where employee_no = v_row.employee_no;
    if not found then
      insert into public.employees (employee_no, name, department_id, headquarters_id, position, role, excluded, status)
      values (v_row.employee_no, trim(v_row.name), v_dept, v_hq, trim(v_row.position), v_row.role,
              coalesce(v_row.excluded, false), 'active');
      v_new := v_new + 1;
    elsif (v_old.name, v_old.department_id, v_old.headquarters_id, v_old.position, v_old.role, v_old.excluded, v_old.status)
          is distinct from
          (trim(v_row.name), v_dept, v_hq, trim(v_row.position), v_row.role, coalesce(v_row.excluded, false), 'active') then
      update public.employees
      set name = trim(v_row.name), department_id = v_dept, headquarters_id = v_hq, position = trim(v_row.position),
          role = v_row.role, excluded = coalesce(v_row.excluded, false),
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
-- 6) 평가 중 조직도 잠금 다시 정의 (014): 직군 없이
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
       or new.excluded      is distinct from old.excluded
       or new.name          is distinct from old.name
       or new.employee_no   is distinct from old.employee_no)
  then
    raise exception '평가 중에는 직원의 부서·본부·직급·역할·평가 제외를 바꿀 수 없습니다 (퇴사 처리만 가능).';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------
-- 7) 직원 표의 직군 칸 삭제 (위 함수들을 먼저 직군 없이 다시 정의했다)
-- ---------------------------------------------------------------
alter table public.employees drop column if exists job_group;

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다. 그다음 90 실행!
-- ---------------------------------------------------------------
-- select
--   (select string_agg(question_set || ' ' || n || '문항/' || pts || '점', ' · ' order by question_set)
--      from (select question_set, count(*) as n,
--                   (select sum(factor_points) from (select distinct q2.field, q2.factor, q2.factor_points
--                      from public.questions q2 where q2.cycle_id = q.cycle_id and q2.question_set = q.question_set) f) as pts
--              from public.questions q where q.cycle_id = 1 group by q.cycle_id, question_set) s)
--     as "1 문항 세트 (leader 5문항/100점 · member 16문항/100점 · upward 5문항/100점)",
--   (select count(*) from information_schema.columns
--     where table_schema = 'public' and table_name = 'employees' and column_name = 'job_group') as "2 직군 칸(0)",
--   (select pg_get_functiondef('public.my_case_details(integer)'::regprocedure) like '%job_group%') as "3 문항 세트 함수에 직군(false)",
--   (select pg_get_functiondef('public.import_employees(jsonb,text[])'::regprocedure) like '%job_group%') as "4 명단 반영에 직군(false)",
--   (select pg_get_functiondef('public.lock_org_in_progress'::regproc) like '%job_group%') as "5 잠금에 직군(false)";
