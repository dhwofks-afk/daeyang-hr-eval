-- 90_demo_reset.sql : 시연 초기화 (리허설 전·발표 전에 실행)
--
-- 실행하면 회차 1이 "평가 전 · 결과 미공개"로 돌아가고, 시연 중에 생긴 기록이 모두 지워진다.
-- 실행 방법: SQL Editor에서 이 파일 전체를 한 번에 실행한다. 중간에 오류가 나면 아무것도 바뀌지 않는다.
--
-- 하는 일
-- 1) 결과 공개 끄기 + 회차 1을 "평가 전"으로, 시작일·마감일 비우기
-- 2) 회차 1의 확정 결과 · 반려 기록 · 보정 기록 · 건의 · 만족도(내용·제출 여부) · 자기관찰 비우기
-- 0) 시연 임원 맞추기 (11/3): 임원 부서마다 1명, 평가 대상. 이미 맞으면 바뀌지 않는다
--    새로 생긴 임원의 로그인 계정은 이 파일 다음에 scripts/create-accounts.mjs --all 로 만든다
-- 1-1) 기술부(생산기술본부)로 옮기기 (11/4): 안성훈(팀장)·오승현·윤태호·송지아. 이미 옮겨져 있으면 바뀌지 않는다
--      → 이정호가 생산부·기술부 팀장 2명과 두 부서 팀원 모두를 임원평가하고, 두 부서 사람 모두가 이정호를 임원상향평가한다
-- 3) 회차 1 평가 건을 모두 지우고(답도 함께 지워짐) 규칙대로 다시 만들기 (127건)
-- 4) 시연용 답 119건을 다시 넣고 "제출"로 바꾸기 (supabase/seed/05_demo_answers.sql과 같은 내용)
--    김민수 관련 4건(자기·박서준→김민수·이정호→김민수·김민수→이정호)과
--    미제출 4건(정다은 자기·남궁현 자기·한지훈→노지환·한지훈→백승민)은 비워 둔다
-- 5) 검사: 평가 전 · 미공개 · 평가 건 127 · 제출 119 · 작성 전 8 · 기록 표 0건
--
-- 015 다음에 실행한다 (임원 상향 단계·본부·평가표 3개). 여러 번 실행해도 결과가 같다.
-- 015 실행 직후에는 반드시 실행한다 (옛 직군별 문항의 답이 지워졌으므로 시연 답을 새 문항으로 다시 넣는다).
-- 답은 문항 세트를 그대로 읽어 넣으므로 문항이 바뀌어도 이 파일은 그대로 쓴다 (팀장 평가표는 11/4부터 서술형 없음).
-- seed에 없는 직원(사번 900001~900030 밖, 예: 화면에서 올린 시험 직원)이 있어도 된다:
--   그 사람이 들어간 평가 건은 "작성 전"으로 두고, 검사는 seed 직원끼리의 건만 센다.
-- 바꾸지 않는 것: 직원(0번 임원 맞추기 · 1-1 기술부 옮기기 제외)·계정·부서·문항, 회차 1의 가중치·비율, 부서 KPI
-- 답의 흔들림은 평가 건 번호로 정하므로, 평가 건을 다시 만들면 문항별 답이 조금 달라질 수 있다 (점수 분포는 같다).
-- 잠금 장치(006) 때문에 순서가 중요하다: 평가 건은 "평가 전"일 때만 만들 수 있고,
-- 답·제출 상태는 "평가 중"일 때만 넣을 수 있어서, 4)는 잠깐 "평가 중"으로 바꿨다가 끝나면 "평가 전"으로 되돌린다.

begin;

-- 0) 시연 임원 맞추기
update employees set department_id = 3, excluded = false
where employee_no = '900028';
insert into employees (employee_no, name, department_id, position, role, excluded, status) values
  ('900029', '윤재석', 1, '이사', 'executive', false, 'active'),
  ('900030', '백승민', 2, '이사', 'executive', false, 'active')
on conflict (employee_no) do nothing;
-- 임원의 본부 (014): 이정호 = 생산기술본부, 백승민 = 기술영업본부, 윤재석 = 본부 없음
update employees e set headquarters_id = h.id
from (values ('900028', '생산기술본부'), ('900030', '기술영업본부')) as v(no, hq)
join headquarters h on h.name = v.hq
where e.employee_no = v.no and e.headquarters_id is distinct from h.id;
update employees set headquarters_id = null where employee_no = '900029' and headquarters_id is not null;

-- 1) 결과 공개 끄기 (공개 여부는 이 표시가 켜져 있을 때만 바꿀 수 있다) + 평가 전으로
select set_config('app.publish_change', 'on', true);
update cycles
set result_published = false, published_at = null,
    status = 'before', start_date = null, deadline = null
where id = 1;
select set_config('app.publish_change', 'off', true);

-- 1-1) 기술부(생산기술본부)로 옮기기 (평가 중에는 부서·역할을 바꿀 수 없어서 "평가 전"으로 바꾼 뒤에 한다)
update employees e set department_id = d.id, role = v.role
from (values ('900023', 'leader'), ('900014', 'member'), ('900015', 'member'), ('900016', 'member')) as v(no, role)
join departments d on d.name = '기술부'
where e.employee_no = v.no and (e.department_id, e.role) is distinct from (d.id, v.role);

-- 2) 기록 비우기 (회차 1)
delete from final_results     where cycle_id = 1;
delete from return_logs       where cycle_id = 1;
delete from adjustments       where cycle_id = 1;
delete from suggestions       where cycle_id = 1;
delete from satisfaction      where cycle_id = 1;
delete from satisfaction_done where cycle_id = 1;
delete from self_observations where cycle_id = 1;

-- 3) 평가 건 다시 만들기 (답은 cases에 연결되어 함께 지워진다)
delete from cases where cycle_id = 1;
select create_cases(1);

-- 4) 답을 넣는 동안만 잠깐 "평가 중"
update cycles set status = 'in_progress' where id = 1;

-- 4-1) 답 넣기
with targets (employee_no, stage, total) as (
  -- 목표 단계 점수 (0~100) = scores.ts 분야 점수 합
  values
    ('900001', 'self', 69),
    ('900001', 'executive', 65),
    ('900001', 'upward', 68),
    ('900002', 'self', 78),
    ('900002', 'leader', 71),
    ('900002', 'executive', 72),
    ('900003', 'self', 98),
    ('900003', 'leader', 94),
    ('900003', 'executive', 95),
    ('900004', 'self', 85),
    ('900004', 'executive', 84),
    ('900004', 'upward', 84),
    ('900005', 'self', 89),
    ('900005', 'leader', 87),
    ('900005', 'executive', 84),
    ('900006', 'self', 98),
    ('900006', 'leader', 92),
    ('900006', 'executive', 94),
    ('900007', 'self', 86),
    ('900007', 'leader', 82),
    ('900007', 'executive', 79),
    ('900008', 'self', 88),
    ('900008', 'leader', 82),
    ('900008', 'executive', 82),
    ('900009', 'self', 91),
    ('900009', 'executive', 87),
    ('900010', 'self', 80),
    ('900010', 'executive', 76),
    ('900010', 'upward', 76),
    ('900011', 'self', 93),
    ('900011', 'leader', 91),
    ('900011', 'executive', 86),
    ('900012', 'self', 89),
    ('900012', 'leader', 86),
    ('900012', 'executive', 85),
    ('900013', 'leader', 78),
    ('900013', 'executive', 77),
    ('900014', 'self', 81),
    ('900014', 'leader', 78),
    ('900014', 'executive', 73),
    ('900015', 'self', 73),
    ('900015', 'leader', 68),
    ('900015', 'executive', 70),
    ('900016', 'self', 71),
    ('900016', 'leader', 69),
    ('900016', 'executive', 69),
    ('900017', 'self', 83),
    ('900017', 'leader', 79),
    ('900017', 'executive', 80),
    ('900018', 'self', 79),
    ('900018', 'leader', 76),
    ('900018', 'executive', 76),
    ('900019', 'self', 75),
    ('900019', 'leader', 70),
    ('900019', 'executive', 71),
    ('900020', 'self', 79),
    ('900020', 'leader', 74),
    ('900020', 'executive', 76),
    ('900021', 'self', 75),
    ('900021', 'leader', 72),
    ('900021', 'executive', 72),
    ('900022', 'self', 92),
    ('900022', 'leader', 88),
    ('900022', 'executive', 88),
    ('900023', 'self', 89),
    ('900023', 'executive', 81),
    ('900023', 'upward', 82),   -- 11/4: 기술부 팀장 (기술부 팀원 3명이 상향평가)
    ('900024', 'self', 92),
    ('900024', 'leader', 89),
    ('900024', 'executive', 86),
    ('900025', 'self', 94),
    ('900025', 'leader', 86),
    ('900025', 'executive', 89),
    ('900026', 'self', 83),
    ('900026', 'leader', 82),
    ('900026', 'executive', 79),
    ('900027', 'leader', 81),
    ('900027', 'executive', 82),
    -- 임원 상향 (scores.ts 임원 3명)
    ('900028', 'exec_upward', 79),
    ('900029', 'exec_upward', 84),
    ('900030', 'exec_upward', 76)
),
empty_cases (target_no, evaluator_no, stage) as (
  values
    ('900011', '900011', 'self'),       -- 시연: 김민수 자기평가
    ('900011', '900010', 'leader'),     -- 시연: 박서준 → 김민수
    ('900011', '900028', 'executive'),  -- 시연: 이정호 → 김민수
    ('900013', '900013', 'self'),       -- scores.ts 미제출: 정다은 자기평가
    ('900027', '900027', 'self'),       -- scores.ts 미제출: 남궁현 자기평가
    ('900009', '900004', 'leader'),     -- scores.ts 미제출: 한지훈 → 노지환
    ('900028', '900011', 'exec_upward'), -- 시연: 김민수 → 이정호 (임원 상향)
    ('900030', '900004', 'exec_upward')  -- scores.ts 미제출: 한지훈 → 백승민 (임원 상향, 팀장 쪽)
),
demo as (
  select c.id as case_id, c.stage, t.role as target_role,
         g.total / 100.0 as ratio
  from cases c
  join employees t on t.id = c.target_id
  join employees e on e.id = c.evaluator_id
  join targets g on g.employee_no = t.employee_no and g.stage = c.stage
  where c.cycle_id = 1
    and e.employee_no between '900001' and '900030'   -- seed 직원끼리의 건만 (평가 대상은 targets로 이미 걸러짐)
    and not exists (
      select 1 from empty_cases x
      where x.target_no = t.employee_no and x.evaluator_no = e.employee_no and x.stage = c.stage
    )
)
insert into answers (case_id, question_id, score, essay)
select
  d.case_id,
  q.id,
  case
    when q.type = 'choice' then
      -- 객관식 1~5: 목표 비율 × 5 에 ±0.7 정도의 흔들림
      greatest(1, least(5, round(
        5 * d.ratio + ((abs(hashtext(d.case_id || ':' || q.id)) % 1000) / 1000.0 - 0.5) * 1.4
      )))
    else round(q.factor_points * d.ratio)  -- 서술형: 0 ~ 배점
  end,
  case
    when q.type = 'essay' and d.stage = 'self'
      then '(시연용) 담당 업무를 계획대로 수행했고, 업무 개선 과제 2건을 마무리했습니다.'
  end
from demo d
join questions q
  on q.cycle_id = 1
 and q.question_set = case when d.stage in ('upward', 'exec_upward') then 'upward'
                           else d.target_role end
where q.type = 'choice'
   or d.stage = 'self'                                        -- 자기평가 서술형
   or (d.stage = 'leader' and d.target_role = 'member')       -- 팀원의 바로 위 평가자
   or (d.stage = 'executive' and d.target_role = 'leader');   -- 팀장의 바로 위 평가자

-- 4-2) 답을 넣은 평가 건을 "제출"로 바꾸기 (답이 있는 건만)
with empty_cases (target_no, evaluator_no, stage) as (
  values
    ('900011', '900011', 'self'),       -- 시연: 김민수 자기평가
    ('900011', '900010', 'leader'),     -- 시연: 박서준 → 김민수
    ('900011', '900028', 'executive'),  -- 시연: 이정호 → 김민수
    ('900013', '900013', 'self'),       -- scores.ts 미제출: 정다은 자기평가
    ('900027', '900027', 'self'),       -- scores.ts 미제출: 남궁현 자기평가
    ('900009', '900004', 'leader'),     -- scores.ts 미제출: 한지훈 → 노지환
    ('900028', '900011', 'exec_upward'), -- 시연: 김민수 → 이정호 (임원 상향)
    ('900030', '900004', 'exec_upward')  -- scores.ts 미제출: 한지훈 → 백승민 (임원 상향, 팀장 쪽)
)
update cases c
set status = 'submitted',
    opinion = '(시연용) 맡은 업무를 성실하게 수행했습니다.',
    submitted_at = now()
from employees t, employees e
where c.cycle_id = 1
  and t.id = c.target_id
  and e.id = c.evaluator_id
  and exists (select 1 from answers a where a.case_id = c.id)
  and not exists (
    select 1 from empty_cases x
    where x.target_no = t.employee_no and x.evaluator_no = e.employee_no and x.stage = c.stage
  );

-- 4) 끝: 다시 "평가 전"
update cycles set status = 'before' where id = 1;

-- 5) 검사: 하나라도 다르면 오류를 내고 위의 모든 변경을 되돌린다
do $$
declare
  v_cycle   text;
  v_cases   integer;
  v_sub     integer;
  v_empty   integer;
  v_bad     integer;
  v_logs    integer;
  v_other   integer;
begin
  select status || ' · '|| result_published into v_cycle from cycles where id = 1;
  -- seed 직원끼리의 건 / 그 밖의 건 (seed에 없는 직원이 들어간 건)
  select count(*) filter (where s),
         count(*) filter (where s and c.status = 'submitted'),
         count(*) filter (where s and c.status = 'not_started'),
         count(*) filter (where not s)
    into v_cases, v_sub, v_empty, v_other
  from (
    select c.status,
           t.employee_no between '900001' and '900030' and e.employee_no between '900001' and '900030' as s
    from cases c
    join employees t on t.id = c.target_id
    join employees e on e.id = c.evaluator_id
    where c.cycle_id = 1
  ) c;
  select count(*) into v_bad from cases c
  where c.cycle_id = 1
    and ((c.status = 'submitted') <> exists (select 1 from answers a where a.case_id = c.id));
  select (select count(*) from final_results     where cycle_id = 1)
       + (select count(*) from return_logs       where cycle_id = 1)
       + (select count(*) from adjustments       where cycle_id = 1)
       + (select count(*) from suggestions       where cycle_id = 1)
       + (select count(*) from satisfaction      where cycle_id = 1)
       + (select count(*) from satisfaction_done where cycle_id = 1)
       + (select count(*) from self_observations where cycle_id = 1)
    into v_logs;

  if v_cycle <> 'before · false' or v_cases <> 127 or v_sub <> 119 or v_empty <> 8
     or v_bad > 0 or v_logs > 0 then
    raise exception '시연 초기화 확인 실패: 회차 %, 평가 건 %, 제출 %, 작성 전 %, 답·상태 어긋남 %, 남은 기록 %',
      v_cycle, v_cases, v_sub, v_empty, v_bad, v_logs;
  end if;
  raise notice '시연 초기화 완료: 회차 1 평가 전 · 미공개, 평가 건 127 (제출 119 · 작성 전 8), seed 밖 직원이 들어간 건 % (작성 전)', v_other;
end
$$;

commit;


-- ---------------------------------------------------------------
-- 확인 쿼리 (읽기만 함): 이정호(생산기술본부)가 생산부·기술부 두 부서를 평가하는지
-- 기대: 생산부 팀장 1 · 팀원 14 / 기술부 팀장 1 · 팀원 3, 부서마다 "임원평가 대상" = "임원상향 평가자" = 그 부서 인원, 빠진 사람 0
-- ---------------------------------------------------------------
-- with lee as (select id from employees where employee_no = '900028'),
-- people as (
--   select e.id, e.role, d.name as dept from employees e join departments d on d.id = e.department_id
--   where d.name in ('생산부', '기술부') and e.role in ('member', 'leader') and e.status = 'active' and not e.excluded
-- )
-- select p.dept as "부서",
--        count(*) filter (where p.role = 'leader') as "팀장",
--        count(*) filter (where p.role = 'member') as "팀원",
--        count(*) filter (where exists (select 1 from cases c where c.cycle_id = 1 and c.stage = 'executive'
--          and c.target_id = p.id and c.evaluator_id = (select id from lee))) as "이정호가 임원평가",
--        count(*) filter (where exists (select 1 from cases c where c.cycle_id = 1 and c.stage = 'exec_upward'
--          and c.target_id = (select id from lee) and c.evaluator_id = p.id)) as "이정호를 임원상향평가",
--        count(*) filter (where not exists (select 1 from cases c where c.cycle_id = 1 and c.stage = 'executive'
--          and c.target_id = p.id and c.evaluator_id = (select id from lee))
--          or not exists (select 1 from cases c where c.cycle_id = 1 and c.stage = 'exec_upward'
--          and c.target_id = (select id from lee) and c.evaluator_id = p.id)) as "빠진 사람(0)"
-- from people p group by p.dept order by p.dept;
