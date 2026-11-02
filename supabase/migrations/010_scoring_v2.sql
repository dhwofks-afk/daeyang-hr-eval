-- 010_scoring_v2.sql : 점수 체계 변경 (차장님 답변 11/2)
--
-- 실행 방법: 008 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- (009_org_lock.sql은 조직도 실제 연결 때 만든다. 번호를 비워 둔다)
-- 실행 후 확인 쿼리로 칸·함수·규칙이 실제로 바뀌었는지 반드시 확인한다.
--
-- 바뀌는 것
-- 1) 상대평가 등급(A~D) 삭제: 등급 비율 칸, 확정 결과의 등급 칸
-- 2) KPI 가산·배율 대신 비율로 섞기
--    팀원 최종 = 개인 평가 × 80% + 부서 KPI × 20%
--    팀장 최종 = 개인 평가 × 30% + 부서 KPI × 30% + 상향 평가 × 40%
--    개인 평가 = 단계 가중 합산 (팀원 자기·팀장·임원 20·40·40 / 팀장 자기·임원 20·80). 상향은 개인 평가에 섞지 않는다
-- 3) 직원 "내 평가 결과" 없음: 공개 범위 칸과 "내 결과 가져오기" 함수 삭제. 결과 공개 = "결과 확정"(확정 결과 저장 + 잠금)
--    (칸 이름 result_published·published_at과 함수 이름 publish_results·unpublish_results는 그대로 둔다)
-- 4) 팀장·임원은 평가 대상의 자기평가 답 중 서술형만 읽는다 (객관식 자기 점수는 못 본다)


-- ---------------------------------------------------------------
-- 1) 회차 설정: 최종 점수 비율 칸 추가 (기본값 = 차장님 답변)
-- ---------------------------------------------------------------
alter table cycles
  add column mix_member_personal numeric(5, 2) not null default 80,   -- 팀원: 개인 평가
  add column mix_member_kpi      numeric(5, 2) not null default 20,   -- 팀원: 부서 KPI
  add column mix_leader_personal numeric(5, 2) not null default 30,   -- 팀장: 개인 평가
  add column mix_leader_kpi      numeric(5, 2) not null default 30,   -- 팀장: 부서 KPI
  add column mix_leader_upward   numeric(5, 2) not null default 40;   -- 팀장: 상향 평가

alter table cycles
  add constraint cycles_mix_range check (
    mix_member_personal between 0 and 100 and mix_member_kpi between 0 and 100 and
    mix_leader_personal between 0 and 100 and mix_leader_kpi between 0 and 100 and
    mix_leader_upward between 0 and 100),
  add constraint cycles_mix_member_sum check (mix_member_personal + mix_member_kpi = 100),
  add constraint cycles_mix_leader_sum check (mix_leader_personal + mix_leader_kpi + mix_leader_upward = 100);


-- ---------------------------------------------------------------
-- 2) 쓰지 않는 칸 지우기 (칸에 걸린 검사 규칙도 함께 지워진다)
--    등급 비율 4칸, KPI 방식·기준값·계수, 팀장 상향 반영 비율(→ mix_leader_upward), 공개 범위, 확정 결과의 등급
-- ---------------------------------------------------------------
alter table cycles
  drop column grade_a,
  drop column grade_b,
  drop column grade_c,
  drop column grade_d,
  drop column kpi_method,
  drop column kpi_base,
  drop column kpi_factor,
  drop column weight_leader_upward,
  drop column public_scope;

alter table final_results drop column grade;


-- ---------------------------------------------------------------
-- 3) 잠금 장치 1 다시 정의 (003·006): 결과가 확정된 회차는 비율을 바꿀 수 없다
--    확정 여부(result_published)는 확정 함수 두 개(publish_results·unpublish_results) 안에서만 바꿀 수 있다
-- ---------------------------------------------------------------
create or replace function public.lock_published_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.result_published is distinct from old.result_published
     and coalesce(current_setting('app.publish_change', true), '') <> 'on' then
    raise exception '결과 확정·확정 취소는 리포트의 [결과 확정]·[확정 취소]로만 할 수 있습니다.';
  end if;

  if old.result_published and (
       new.weight_member_self      is distinct from old.weight_member_self
    or new.weight_member_leader    is distinct from old.weight_member_leader
    or new.weight_member_executive is distinct from old.weight_member_executive
    or new.weight_leader_self      is distinct from old.weight_leader_self
    or new.weight_leader_executive is distinct from old.weight_leader_executive
    or new.mix_member_personal     is distinct from old.mix_member_personal
    or new.mix_member_kpi          is distinct from old.mix_member_kpi
    or new.mix_leader_personal     is distinct from old.mix_leader_personal
    or new.mix_leader_kpi          is distinct from old.mix_leader_kpi
    or new.mix_leader_upward       is distinct from old.mix_leader_upward
  ) then
    raise exception '결과가 확정된 회차는 점수 설정을 바꿀 수 없습니다.';
  end if;
  return new;
end;
$$;


-- ---------------------------------------------------------------
-- 4) 결과 확정 함수 다시 정의 (006): 등급 칸 없이 저장한다
--    p_results 예: [{"employee_id": 5, "department_name": "생산", "score_self": 78, "score_leader": 82,
--                   "score_executive": 80, "score_upward": null, "weighted": 80.4,
--                   "kpi_applied": 82.3, "final": 82.3}, ...]
--    (weighted = 개인 평가, kpi_applied = 비율로 섞은 점수(보정 전), final = 보정 후 최종 점수)
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
    raise exception '확정할 결과가 없습니다.';
  end if;

  insert into public.final_results (
    cycle_id, employee_id, department_name,
    score_self, score_leader, score_executive, score_upward,
    weighted, kpi_applied, final, published_at
  )
  select p_cycle_id, r.employee_id, r.department_name,
         r.score_self, r.score_leader, r.score_executive, r.score_upward,
         r.weighted, r.kpi_applied, r.final, v_now
  from jsonb_to_recordset(p_results) as r (
    employee_id integer, department_name text,
    score_self numeric, score_leader numeric, score_executive numeric, score_upward numeric,
    weighted numeric, kpi_applied numeric, final numeric
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
    published_at    = excluded.published_at;
  get diagnostics v_count = row_count;

  perform set_config('app.publish_change', 'on', true);  -- 이 거래 안에서만 확정 여부 변경 허용
  update public.cycles set result_published = true, published_at = v_now where id = p_cycle_id;
  perform set_config('app.publish_change', 'off', true);
  return v_count;
end;
$$;


-- ---------------------------------------------------------------
-- 5) 새 회차 함수 다시 정의 (006): 바뀐 설정 칸을 복사한다
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
    weight_leader_self, weight_leader_executive,
    mix_member_personal, mix_member_kpi,
    mix_leader_personal, mix_leader_kpi, mix_leader_upward,
    result_published, published_at
  )
  select v_new, trim(p_name), 'before', null, null,
         weight_member_self, weight_member_leader, weight_member_executive,
         weight_leader_self, weight_leader_executive,
         mix_member_personal, mix_member_kpi,
         mix_leader_personal, mix_leader_kpi, mix_leader_upward,
         false, null
  from public.cycles where id = v_last;

  insert into public.questions (cycle_id, question_set, field, factor, factor_points, content, type, sort_order)
  select v_new, question_set, field, factor, factor_points, content, type, sort_order
  from public.questions where cycle_id = v_last;

  perform public.create_cases(v_new);
  return v_new;
end;
$$;


-- ---------------------------------------------------------------
-- 6) 직원 "내 결과 가져오기" 함수 삭제 (직원 결과 화면 없음)
-- ---------------------------------------------------------------
drop function if exists public.get_my_result(integer);


-- ---------------------------------------------------------------
-- 7) 답 읽기 규칙 (002 고침)
--    - 내가 평가자인 평가 건의 답: 전부
--    - 예외: 내가 팀장·임원 단계로 평가하는 사람의 자기평가 답 중 "서술형"만 (서술형 점수를 정하려면 필요)
--      객관식 자기 점수는 보지 못한다. 상향 평가자(팀원)는 팀장의 자기평가를 못 본다
-- ---------------------------------------------------------------
create or replace function public.can_read_answer(p_case_id integer, p_question_id integer)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    where c.id = p_case_id and c.evaluator_id = public.my_employee_id()
  )
  or exists (
    select 1
    from public.cases self_case
    join public.cases mine
      on mine.target_id = self_case.target_id
     and mine.cycle_id = self_case.cycle_id
    join public.questions q on q.id = p_question_id
    where self_case.id = p_case_id
      and self_case.stage = 'self'
      and q.type = 'essay'
      and mine.evaluator_id = public.my_employee_id()
      and mine.stage in ('leader', 'executive')
  )
$$;

revoke execute on function public.can_read_answer(integer, integer) from public, anon;
grant execute on function public.can_read_answer(integer, integer) to authenticated;

drop policy "답: 읽기" on public.answers;
create policy "답: 읽기" on public.answers
  for select to authenticated using (public.can_read_answer(case_id, question_id));

drop function if exists public.can_read_case_answers(integer);
