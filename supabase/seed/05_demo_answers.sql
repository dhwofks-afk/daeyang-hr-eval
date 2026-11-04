-- 05_demo_answers.sql : 시연용 답과 "제출" 상태
-- - 점수 분포는 src/data/scores.ts의 단계 점수와 비슷하게 만든다 (아래 목표 점수표).
-- - 같은 데이터로 실행하면 언제나 같은 답이 나온다 (무작위 대신 평가 건·문항 번호로 정한 흔들림).
-- - 아래 8건은 답 없이 "작성 전"으로 남긴다: 발표 중 실제로 제출할 4건(김민수) + scores.ts에서 미제출인 4건.
-- 서술형(본인서술형) 점수: 자기평가는 본인이 쓴 점수(참고용),
--   "바로 위 평가자"(팀원 → 팀장 평가, 팀장 → 임원 평가)만 최종 점수를 넣는다. 그 밖의 평가자는 서술형을 읽기만 해서 답이 없다.
--   (11/4부터 팀장 평가표에는 서술형이 없다. 서술형은 팀원 평가표에만 있다)
-- 사람은 사번으로 적었지만, 표에는 내부 번호로 연결해 넣는다 (사번은 이 파일 안에서 짝을 찾는 데만 쓴다).

-- 1) 답 넣기
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

-- 2) 답을 넣은 평가 건을 "제출"로 바꾸기
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
  and not exists (
    select 1 from empty_cases x
    where x.target_no = t.employee_no and x.evaluator_no = e.employee_no and x.stage = c.stage
  );

-- 검사: 제출 119건 + 작성 전 8건 (11/4: 안성훈이 기술부 팀장이 되어 129 → 127건), 제출된 건은 모두 답이 있고, 작성 전인 건은 답이 없다
do $$
declare
  v_submitted integer;
  v_empty integer;
  v_submitted_without_answers integer;
  v_empty_with_answers integer;
begin
  select count(*) filter (where status = 'submitted'),
         count(*) filter (where status = 'not_started')
    into v_submitted, v_empty
  from cases where cycle_id = 1;

  select count(*) into v_submitted_without_answers
  from cases c
  where c.cycle_id = 1 and c.status = 'submitted'
    and not exists (select 1 from answers a where a.case_id = c.id);

  select count(*) into v_empty_with_answers
  from cases c
  where c.cycle_id = 1 and c.status = 'not_started'
    and exists (select 1 from answers a where a.case_id = c.id);

  if v_submitted <> 119 or v_empty <> 8
     or v_submitted_without_answers > 0 or v_empty_with_answers > 0 then
    raise exception '시연용 답 확인 실패: 제출 %, 작성 전 %, 답 없는 제출 %, 답 있는 작성 전 %',
      v_submitted, v_empty, v_submitted_without_answers, v_empty_with_answers;
  end if;
end
$$;
