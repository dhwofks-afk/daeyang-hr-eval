-- 018_empty_cycle.sql : 빈 평가 추가 · 평가 시작 전 문항 검사 (11/4 결정)
--
-- 실행 방법: 017 다음에 SQL Editor에서 이 파일 전체를 실행한다 (실행: 오재란).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 여러 번 실행해도 안전하다 (함수만 다시 정의한다. 기록은 바꾸지 않는다). 실행 후 맨 아래 확인 쿼리를 따로 돌린다.
--
-- 바뀌는 것
-- 1) new_cycle(이름, 복사할 평가): 복사할 평가를 비우면(null) "빈 평가"
--    문항 없음 · 반영 비율은 기본값 · 부서 KPI는 비움 · 평가 관계는 규칙대로
--    기본값: 가중치 팀원 자기 20/팀장 40/임원 40, 팀장 자기 20/임원 80
--            최종 비율 팀원 개인 80/KPI 20, 팀장 개인 20/KPI 40/상향 40, 임원 상향 40/KPI 60, 임원 상향 안 팀원 50/팀장 50
-- 2) start_cycle: 평가표(팀원·팀장·상향)마다 문항이 있고 배점 합이 100일 때만 시작한다. 아니면 무엇이 부족한지 알려 준다
--    (배점 합 = 평가 내용마다 한 번씩 더한 값. 화면 계산과 같다)

begin;

-- ---------------------------------------------------------------
-- 1) 평가 추가 다시 정의 (016): 복사할 평가가 없으면 빈 평가
-- ---------------------------------------------------------------
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
  if p_source is not null and not exists (select 1 from public.cycles where id = p_source) then
    raise exception '복사할 평가를 찾을 수 없습니다.';
  end if;

  select coalesce(max(id), 0) + 1 into v_new from public.cycles;

  if p_source is null then
    -- 빈 평가: 반영 비율은 기본값, 문항 없음, 부서 KPI 비움
    insert into public.cycles (
      id, name, status, start_date, deadline,
      weight_member_self, weight_member_leader, weight_member_executive,
      weight_leader_self, weight_leader_executive,
      mix_member_personal, mix_member_kpi,
      mix_leader_personal, mix_leader_kpi, mix_leader_upward,
      mix_exec_upward, mix_exec_kpi, exec_upward_member, exec_upward_leader,
      result_published, published_at
    ) values (
      v_new, trim(p_name), 'before', null, null,
      20, 40, 40,
      20, 80,
      80, 20,
      20, 40, 40,
      40, 60, 50, 50,
      false, null
    );

    insert into public.cycle_kpis (cycle_id, department_id, kpi)
    select v_new, d.id, null from public.departments d;
  else
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

    -- 부서 KPI: 복사할 평가 값. 그 평가에 없는 부서(나중에 생긴 부서)는 비워 둔다
    insert into public.cycle_kpis (cycle_id, department_id, kpi)
    select v_new, d.id, k.kpi
    from public.departments d
    left join public.cycle_kpis k on k.cycle_id = p_source and k.department_id = d.id;
  end if;

  perform public.create_cases(v_new);
  return v_new;
end;
$$;
revoke execute on function public.new_cycle(text, integer) from public, anon;
grant execute on function public.new_cycle(text, integer) to authenticated;


-- ---------------------------------------------------------------
-- 2) 평가 시작 다시 정의 (016): 평가표마다 문항이 있고 배점 합 100
-- ---------------------------------------------------------------
create or replace function public.start_cycle(p_cycle_id integer, p_start date, p_deadline date)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status   text;
  v_other    text;
  v_problems text[] := '{}';
  v_set      record;
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

  -- 평가표마다 문항 수와 배점 합 (평가 내용마다 한 번씩)
  for v_set in
    select s.code, s.label,
           (select count(*) from public.questions q where q.cycle_id = p_cycle_id and q.question_set = s.code) as n,
           (select coalesce(sum(f.points), 0) from (
              select max(q.factor_points) as points from public.questions q
              where q.cycle_id = p_cycle_id and q.question_set = s.code
              group by q.field, q.factor) f) as total
    from (values ('member', '팀원', 1), ('leader', '팀장', 2), ('upward', '상향', 3)) as s(code, label, ord)
    order by s.ord
  loop
    if v_set.n = 0 then
      v_problems := v_problems || format('%s 평가표에 문항이 없습니다', v_set.label);
    elsif v_set.total <> 100 then
      v_problems := v_problems || format('%s 평가표 배점 합계가 %s점입니다 (100점이어야 함)', v_set.label, v_set.total);
    end if;
  end loop;
  if array_length(v_problems, 1) > 0 then
    raise exception '평가를 시작할 수 없습니다: %', array_to_string(v_problems, ' / ');
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

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다
-- 기대: 1 true / 2 true / 3 회차 1 문항 세트 3종 모두 "문항 n개 · 100점"
-- ---------------------------------------------------------------
-- select
--   (select pg_get_functiondef('public.new_cycle(text,integer)'::regprocedure) like '%p_source is null%') as "1 빈 평가(true)",
--   (select pg_get_functiondef('public.start_cycle(integer,date,date)'::regprocedure) like '%v_problems%') as "2 시작 검사(true)",
--   (select string_agg(question_set || ' 문항 ' || n || '개 · ' || total || '점', ' / ' order by question_set)
--      from (select question_set, count(*) as n,
--                   (select sum(m) from (select max(q2.factor_points) m from questions q2
--                     where q2.cycle_id = 1 and q2.question_set = q.question_set group by q2.field, q2.factor) x) as total
--              from questions q where q.cycle_id = 1 group by question_set) s) as "3 회차 1 평가표";
