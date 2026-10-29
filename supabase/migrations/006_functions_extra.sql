-- 006_functions_extra.sql : 서버 함수 8개 + 잠금 장치 (docs/07-서버추가.md 3·4번)
--
-- 실행 방법: 005 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- 실행 후 확인 쿼리로 함수·트리거가 실제로 생겼는지 반드시 확인한다.
-- 관리자 함수는 안에서 관리자인지 먼저 확인한다. 어떤 함수도 사번을 돌려주지 않는다.


-- ---------------------------------------------------------------
-- 내부 함수: 평가 건을 규칙대로 만든다 (5-3 seed 04_cases.sql과 같은 규칙)
-- 대상: 재직 + 평가 제외 아님인 팀원·팀장 / 평가자: 재직
-- 자기 / 같은 부서 팀장 / 임원(재직 임원 중 내부 번호가 가장 작은 사람) / 상향(팀원 → 같은 부서 팀장)
-- 이미 있는 건은 건너뛴다. 화면에서는 부를 수 없다 (아래 함수들 안에서만 쓴다)
-- ---------------------------------------------------------------
create or replace function public.create_cases(p_cycle_id integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_executive integer;
  v_count     integer;
begin
  select x.id into v_executive from public.employees x
  where x.role = 'executive' and x.status = 'active'
  order by x.id limit 1;

  insert into public.cases (cycle_id, target_id, evaluator_id, stage)
  select p_cycle_id, t.id, t.id, 'self'
  from public.employees t
  where t.role in ('member', 'leader') and t.status = 'active' and not t.excluded
  union all
  select p_cycle_id, t.id, l.id, 'leader'
  from public.employees t
  join public.employees l
    on l.department_id = t.department_id and l.role = 'leader' and l.status = 'active'
  where t.role = 'member' and t.status = 'active' and not t.excluded
  union all
  select p_cycle_id, t.id, v_executive, 'executive'
  from public.employees t
  where t.role in ('member', 'leader') and t.status = 'active' and not t.excluded
    and v_executive is not null
  union all
  select p_cycle_id, t.id, m.id, 'upward'
  from public.employees t
  join public.employees m
    on m.department_id = t.department_id and m.role = 'member' and m.status = 'active'
  where t.role = 'leader' and t.status = 'active' and not t.excluded
  on conflict (cycle_id, target_id, evaluator_id, stage) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;


-- 관리자가 아니면 멈춘다 (아래 관리자 함수들 맨 앞에서 부른다)
create or replace function public.require_admin()
returns void
language plpgsql stable
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다.';
  end if;
end;
$$;


-- ---------------------------------------------------------------
-- 1) 평가 시작: "평가 전" → "평가 중", 날짜 저장. 평가 건이 없으면 규칙대로 만든 뒤 시작
-- ---------------------------------------------------------------
create or replace function public.start_cycle(p_cycle_id integer, p_start date, p_deadline date)
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
  if v_status <> 'before' then
    raise exception '"평가 전" 회차만 시작할 수 있습니다.';
  end if;
  if p_start is not null and p_deadline is not null and p_deadline < p_start then
    raise exception '마감일은 시작일보다 앞설 수 없습니다.';
  end if;

  -- 평가 건은 "평가 전"일 때만 만들 수 있으므로 상태를 바꾸기 전에 만든다
  if not exists (select 1 from public.cases where cycle_id = p_cycle_id) then
    perform public.create_cases(p_cycle_id);
  end if;

  update public.cycles
  set status = 'in_progress', start_date = p_start, deadline = p_deadline
  where id = p_cycle_id;
end;
$$;


-- ---------------------------------------------------------------
-- 2) 마감일 수정: 평가 중일 때만
-- ---------------------------------------------------------------
create or replace function public.update_deadline(p_cycle_id integer, p_deadline date)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_cycle public.cycles%rowtype;
begin
  perform public.require_admin();
  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if not found then
    raise exception '회차를 찾을 수 없습니다.';
  end if;
  if v_cycle.status <> 'in_progress' then
    raise exception '평가 중일 때만 마감일을 바꿀 수 있습니다.';
  end if;
  if p_deadline is not null and v_cycle.start_date is not null and p_deadline < v_cycle.start_date then
    raise exception '마감일은 시작일보다 앞설 수 없습니다.';
  end if;

  update public.cycles set deadline = p_deadline where id = p_cycle_id;
end;
$$;


-- ---------------------------------------------------------------
-- 3) 반려: 평가 중·결과 공개 전·제출 상태일 때만. 사유 필수. 상태 "반려" + 반려 기록 추가
-- ---------------------------------------------------------------
create or replace function public.return_case(p_case_id integer, p_reason text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_case  public.cases%rowtype;
  v_cycle public.cycles%rowtype;
begin
  perform public.require_admin();
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception '반려 사유를 입력해 주세요.';
  end if;

  select * into v_case from public.cases where id = p_case_id for update;
  if not found then
    raise exception '평가 건을 찾을 수 없습니다.';
  end if;
  select * into v_cycle from public.cycles where id = v_case.cycle_id;
  if v_cycle.status <> 'in_progress' then
    raise exception '평가 중일 때만 반려할 수 있습니다.';
  end if;
  if v_cycle.result_published then
    raise exception '결과가 공개된 뒤에는 반려할 수 없습니다.';
  end if;
  if v_case.status <> 'submitted' then
    raise exception '제출된 평가만 반려할 수 있습니다.';
  end if;

  update public.cases set status = 'returned' where id = p_case_id;
  insert into public.return_logs (cycle_id, case_id, reason, returned_by)
  values (v_case.cycle_id, p_case_id, trim(p_reason), '관리자');
end;
$$;


-- ---------------------------------------------------------------
-- 4) 결과 공개: 화면이 scoring.ts로 계산한 결과 목록을 받아 확정 결과에 저장하고 공개를 켠다
--    다시 공개하면 그 회차 확정 결과를 새 값으로 덮어쓴다
--    p_results 예: [{"employee_id": 5, "department_name": "생산", "score_self": 78, "score_leader": 82,
--                   "score_executive": 80, "score_upward": null, "weighted": 80.4,
--                   "kpi_applied": 80.8, "final": 80.8, "grade": "B"}, ...]
-- 5) 공개 취소: 공개를 끈다. 확정 결과는 남긴다
-- 공개 여부(result_published)는 이 두 함수 안에서만 바꿀 수 있다 (아래 잠금 장치 1 참고)
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
    raise exception '공개할 결과가 없습니다.';
  end if;

  insert into public.final_results (
    cycle_id, employee_id, department_name,
    score_self, score_leader, score_executive, score_upward,
    weighted, kpi_applied, final, grade, published_at
  )
  select p_cycle_id, r.employee_id, r.department_name,
         r.score_self, r.score_leader, r.score_executive, r.score_upward,
         r.weighted, r.kpi_applied, r.final, r.grade, v_now
  from jsonb_to_recordset(p_results) as r (
    employee_id integer, department_name text,
    score_self numeric, score_leader numeric, score_executive numeric, score_upward numeric,
    weighted numeric, kpi_applied numeric, final numeric, grade text
  )
  on conflict (cycle_id, employee_id) do update set
    department_name = excluded.department_name,
    score_self      = excluded.score_self,
    score_leader    = excluded.score_leader,
    score_executive = excluded.score_executive,
    score_upward    = excluded.score_upward,
    weighted        = excluded.weighted,
    kpi_applied     = excluded.kpi_applied,
    final           = excluded.final,
    grade           = excluded.grade,
    published_at    = excluded.published_at;
  get diagnostics v_count = row_count;

  perform set_config('app.publish_change', 'on', true);  -- 이 거래 안에서만 공개 여부 변경 허용
  update public.cycles set result_published = true, published_at = v_now where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
  return v_count;
end;
$$;

create or replace function public.unpublish_results(p_cycle_id integer)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if not exists (select 1 from public.cycles where id = p_cycle_id) then
    raise exception '회차를 찾을 수 없습니다.';
  end if;

  perform set_config('app.publish_change', 'on', true);
  update public.cycles set result_published = false, published_at = null where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
end;
$$;


-- ---------------------------------------------------------------
-- 6) 새 회차: 직전 회차(번호가 가장 큰 회차)의 설정·문항을 복사해 "평가 전" 회차를 만들고
--    재직·평가 제외 아닌 직원으로 평가 건을 규칙대로 미리 만든다. 새 회차 번호를 돌려준다
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
    weight_leader_self, weight_leader_executive, weight_leader_upward,
    kpi_method, kpi_base, kpi_factor,
    grade_a, grade_b, grade_c, grade_d,
    result_published, published_at, public_scope
  )
  select v_new, trim(p_name), 'before', null, null,
         weight_member_self, weight_member_leader, weight_member_executive,
         weight_leader_self, weight_leader_executive, weight_leader_upward,
         kpi_method, kpi_base, kpi_factor,
         grade_a, grade_b, grade_c, grade_d,
         false, null, public_scope
  from public.cycles where id = v_last;

  insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order)
  select v_new, question_set, field, factor, factor_points, content, type, sort_order
  from public.questions where cycle_id = v_last;

  perform public.create_cases(v_new);
  return v_new;
end;
$$;


-- ---------------------------------------------------------------
-- 7) 만족도 제출 (직원): 평가 중·공개 전에만. 이미 냈으면 거부
--    내용(작성자 없음)과 제출 여부를 한 번에 저장한다
-- ---------------------------------------------------------------
create or replace function public.submit_satisfaction(p_cycle_id integer, p_score integer, p_comment text)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_me integer := public.my_employee_id();
begin
  if v_me is null then
    raise exception '직원 계정으로 로그인해야 합니다.';
  end if;
  if not public.cycle_is_open(p_cycle_id) then
    raise exception '평가 중일 때만 제출할 수 있습니다.';
  end if;
  if p_score is null or p_score not between 1 and 5 then
    raise exception '점수는 1~5 중에서 골라 주세요.';
  end if;

  insert into public.satisfaction_done (cycle_id, employee_id)
  values (p_cycle_id, v_me)
  on conflict do nothing;
  if not found then
    raise exception '이미 만족도를 제출했습니다.';
  end if;

  insert into public.satisfaction (cycle_id, score, comment)
  values (p_cycle_id, p_score, nullif(trim(p_comment), ''));
end;
$$;


-- ---------------------------------------------------------------
-- 8) 내 평가 건의 최근 반려 사유 (평가자 본인만). 반려된 적이 없으면 null
-- ---------------------------------------------------------------
create or replace function public.my_return_reason(p_case_id integer)
returns text
language sql stable security definer
set search_path = ''
as $$
  select l.reason
  from public.return_logs l
  join public.cases c on c.id = l.case_id
  where l.case_id = p_case_id
    and c.evaluator_id = public.my_employee_id()
  order by l.returned_at desc, l.id desc
  limit 1
$$;


-- ---------------------------------------------------------------
-- 잠금 장치 1 (003 고침): 결과가 공개된 회차는 가중치·KPI·등급 비율을 바꿀 수 없다
-- 공개 여부(result_published)는 언제나 공개 함수 두 개(publish_results·unpublish_results) 안에서만 바꿀 수 있다
-- ---------------------------------------------------------------
create or replace function public.lock_published_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.result_published is distinct from old.result_published
     and coalesce(current_setting('app.publish_change', true), '') <> 'on' then
    raise exception '결과 공개·공개 취소는 리포트의 [결과 공개]·[공개 취소]로만 할 수 있습니다.';
  end if;

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
  ) then
    raise exception '결과가 공개된 회차는 점수 설정을 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;
-- 트리거(cycles_lock_published)는 003에서 이미 이 함수에 연결되어 있다


-- ---------------------------------------------------------------
-- 잠금 장치 2: 회차가 "평가 전"이 아니면 그 회차 문항을 추가·수정·삭제할 수 없다 (관리자도)
-- ---------------------------------------------------------------
create or replace function public.lock_started_questions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
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

create trigger questions_lock_started
  before insert or update or delete on public.questions
  for each row execute function public.lock_started_questions();


-- ---------------------------------------------------------------
-- 잠금 장치 3: 평가 건
-- - 회차가 "평가 전"이 아니면 평가 건 추가·삭제, 대상·평가자·단계·회차 변경 불가 (관리자도)
-- - 회차가 "평가 중"이 아니면 직원은 평가 건의 상태·의견을 바꿀 수 없다 (평가 전 작성 금지)
-- ---------------------------------------------------------------
create or replace function public.lock_cases()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select c.status into v_status from public.cycles c
  where c.id = case when tg_op = 'DELETE' then old.cycle_id else new.cycle_id end;

  if tg_op in ('INSERT', 'DELETE') then
    if v_status <> 'before' then
      raise exception '평가가 시작된 회차에는 평가 건을 추가하거나 지울 수 없습니다.';
    end if;
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- 수정
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

create trigger cases_lock
  before insert or update or delete on public.cases
  for each row execute function public.lock_cases();


-- ---------------------------------------------------------------
-- 잠금 장치 4: 회차가 "평가 중"이 아니면 직원은 답을 추가·수정할 수 없다 (평가 전 작성 금지)
-- ---------------------------------------------------------------
create or replace function public.lock_answers()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_admin() and not exists (
    select 1 from public.cases k
    join public.cycles c on c.id = k.cycle_id
    where k.id = new.case_id and c.status = 'in_progress'
  ) then
    raise exception '평가 중일 때만 작성할 수 있습니다.';
  end if;
  return new;
end;
$$;

create trigger answers_lock
  before insert or update on public.answers
  for each row execute function public.lock_answers();


-- ---------------------------------------------------------------
-- 함수 호출 권한: 로그인한 사람만. 내부 함수·잠금 장치는 아무에게도 주지 않는다
-- ---------------------------------------------------------------
revoke execute on function public.create_cases(integer) from public, anon, authenticated;
revoke execute on function public.require_admin() from public, anon, authenticated;
revoke execute on function public.lock_started_questions() from public, anon, authenticated;
revoke execute on function public.lock_cases() from public, anon, authenticated;
revoke execute on function public.lock_answers() from public, anon, authenticated;
revoke execute on function public.lock_published_cycle() from public, anon, authenticated;

revoke execute on function public.start_cycle(integer, date, date) from public, anon;
revoke execute on function public.update_deadline(integer, date) from public, anon;
revoke execute on function public.return_case(integer, text) from public, anon;
revoke execute on function public.publish_results(integer, jsonb) from public, anon;
revoke execute on function public.unpublish_results(integer) from public, anon;
revoke execute on function public.new_cycle(text) from public, anon;
revoke execute on function public.submit_satisfaction(integer, integer, text) from public, anon;
revoke execute on function public.my_return_reason(integer) from public, anon;

grant execute on function public.start_cycle(integer, date, date) to authenticated;
grant execute on function public.update_deadline(integer, date) to authenticated;
grant execute on function public.return_case(integer, text) to authenticated;
grant execute on function public.publish_results(integer, jsonb) to authenticated;
grant execute on function public.unpublish_results(integer) to authenticated;
grant execute on function public.new_cycle(text) to authenticated;
grant execute on function public.submit_satisfaction(integer, integer, text) to authenticated;
grant execute on function public.my_return_reason(integer) to authenticated;
