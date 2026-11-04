-- 012_my_evaluations.sql : 평가 목록·작성 실제 연결 (docs/06·12, 11/4)
--
-- 실행 방법: 011(그리고 009) 다음에 SQL Editor에서 이 파일 전체를 실행한다.
-- 여러 번 실행해도 안전하다 (규칙은 지우고 다시 만들고, 함수는 다시 정의한다).
-- 전체를 begin/commit으로 묶어, 중간에 오류가 나면 아무것도 바뀌지 않는다.
-- 실행 후 맨 아래 확인 쿼리로 규칙·함수가 실제로 바뀌었는지 반드시 확인한다.
--
-- 바뀌는 것
-- 1) 평가 건 제출 규칙 (001): "제출이면 의견 필수" → 자기평가는 의견 없이 제출할 수 있다 (자기평가엔 종합 의견 칸이 없음, docs/06·10)
--    제출 시각은 그대로 필수
-- 2) my_case_details(회차): 내 평가 건마다 문항 세트와 대상 역할 (직원은 직원 표를 못 읽어 화면이 문항 세트를 알 수 없었다)
-- 3) my_target_self_essays(회차): 내가 팀장·임원 단계로 평가하는 사람의 자기평가 서술형 (대상이 제출했을 때만)
--    읽을 수 있는 범위는 010 can_read_answer와 같다 (서술형만). 직원은 남의 평가 건 번호를 알 수 없어 함수로 이어 준다

begin;

-- ---------------------------------------------------------------
-- 1) 제출 규칙: 의견을 검사하던 규칙을 모두 지우고 새 규칙 하나로 만든다
--    (001의 규칙은 이름 없이 만들어져 이름을 정확히 모르므로, 정의에 opinion이 들어간 검사 규칙을 찾아 지운다)
-- ---------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cases'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%opinion%'
  loop
    execute format('alter table public.cases drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.cases add constraint cases_submit_check
  check (status <> 'submitted'
         or (submitted_at is not null
             and (stage = 'self' or (opinion is not null and length(trim(opinion)) > 0))));


-- ---------------------------------------------------------------
-- 2) 내 평가 건의 문항 세트·대상 역할
--    상향·임원 상향은 상향 세트, 나머지는 대상의 직군 × 역할 (src/data/evaluations.ts questionSetOf와 같은 규칙)
-- ---------------------------------------------------------------
create or replace function public.my_case_details(p_cycle_id integer)
returns table (
  case_id      integer,  -- 내 평가 건 번호
  question_set text,     -- 문항 세트
  target_role  text      -- 대상 역할 (서술형 화면을 정할 때 씀: 임원 평가는 팀장 대상만 점수 입력)
)
language sql stable security definer
set search_path = ''
as $$
  select
    c.id,
    case
      when c.stage in ('upward', 'exec_upward') then 'upward'
      else t.job_group || '_' || case when t.role = 'leader' then 'leader' else 'member' end
    end,
    t.role
  from public.cases c
  join public.employees t on t.id = c.target_id
  where c.cycle_id = p_cycle_id
    and c.evaluator_id = public.my_employee_id()
$$;


-- ---------------------------------------------------------------
-- 3) 내가 팀장·임원 단계로 평가하는 사람의 자기평가 서술형 (대상이 제출한 경우만)
-- ---------------------------------------------------------------
create or replace function public.my_target_self_essays(p_cycle_id integer)
returns table (
  my_case_id  integer,  -- 내 평가 건 번호 (팀장·임원 단계)
  question_id integer,  -- 서술형 문항
  essay       text,     -- 서술 내용
  score       numeric   -- 자기 점수 (참고용)
)
language sql stable security definer
set search_path = ''
as $$
  select mine.id, a.question_id, a.essay, a.score
  from public.cases mine
  join public.cases s
    on s.cycle_id = mine.cycle_id
   and s.target_id = mine.target_id
   and s.stage = 'self'
   and s.status = 'submitted'
  join public.answers a on a.case_id = s.id
  join public.questions q on q.id = a.question_id and q.type = 'essay'
  where mine.cycle_id = p_cycle_id
    and mine.evaluator_id = public.my_employee_id()
    and mine.stage in ('leader', 'executive')
$$;

revoke execute on function public.my_case_details(integer) from public, anon;
revoke execute on function public.my_target_self_essays(integer) from public, anon;
grant execute on function public.my_case_details(integer) to authenticated;
grant execute on function public.my_target_self_essays(integer) to authenticated;

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함). 실행 후 SQL Editor에서 따로 돌린다
-- ---------------------------------------------------------------
-- select
--   (select string_agg(conname || ': ' || pg_get_constraintdef(oid), ' / ')
--      from pg_constraint where conrelid = 'public.cases'::regclass and contype = 'c'
--      and pg_get_constraintdef(oid) like '%opinion%') as "1 제출 규칙 (cases_submit_check 하나, stage = 'self' 포함)",
--   (select count(*) from pg_proc where proname = 'my_case_details') as "2 문항 세트 함수(1)",
--   (select count(*) from pg_proc where proname = 'my_target_self_essays') as "3 자기평가 서술형 함수(1)",
--   (select count(*) from public.cases where status = 'submitted' and stage <> 'self'
--      and (opinion is null or length(trim(opinion)) = 0)) as "4 의견 없는 제출(0)";
-- 기대: "cases_submit_check: CHECK (... stage = 'self'::text ...)" / 1 / 1 / 0
