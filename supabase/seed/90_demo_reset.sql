-- 90_demo_reset.sql : 시연 초기화 (리허설 전·발표 전에 실행)
--
-- 실행하면 회차 1이 "평가 전 · 결과 미공개"로 돌아가고, 시연 중에 생긴 기록이 모두 지워진다.
-- 실행 방법: SQL Editor에서 이 파일 전체를 한 번에 실행한다. 중간에 오류가 나면 아무것도 바뀌지 않는다.
--
-- 하는 일
-- 1) 결과 공개 끄기 + 회차 1을 "평가 전"으로, 시작일·마감일 비우기
-- 2) 회차 1의 확정 결과 · 반려 기록 · 보정 기록 · 건의 · 만족도(내용·제출 여부) · 자기관찰 비우기
-- 3) 회차 1 평가 건을 모두 지우고(답도 함께 지워짐) 규칙대로 다시 만들기 (102건)
-- 4) 시연용 답 96건을 다시 넣고 "제출"로 바꾸기 (supabase/seed/05_demo_answers.sql과 같은 내용)
--    김민수 관련 3건(자기·박서준→김민수·이정호→김민수)과 미제출 3건(정다은 자기·남궁현 자기·한지훈→노지환)은 비워 둔다
-- 5) 검사: 평가 전 · 미공개 · 평가 건 102 · 제출 96 · 작성 전 6 · 기록 표 0건
--
-- 바꾸지 않는 것: 직원·계정·부서·문항, 회차 1의 가중치·KPI·등급 비율, 부서 KPI
-- 답의 흔들림은 평가 건 번호로 정하므로, 평가 건을 다시 만들면 문항별 답이 조금 달라질 수 있다 (점수 분포는 같다).
-- 잠금 장치(006) 때문에 순서가 중요하다: 평가 건은 "평가 전"일 때만 만들 수 있고,
-- 답·제출 상태는 "평가 중"일 때만 넣을 수 있어서, 4)는 잠깐 "평가 중"으로 바꿨다가 끝나면 "평가 전"으로 되돌린다.

begin;

-- 1) 결과 공개 끄기 (공개 여부는 이 표시가 켜져 있을 때만 바꿀 수 있다) + 평가 전으로
select set_config('app.publish_change', 'on', true);
update cycles
set result_published = false, published_at = null,
    status = 'before', start_date = null, deadline = null
where id = 1;
select set_config('app.publish_change', 'off', true);

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
    ('900023', 'leader', 85),
    ('900023', 'executive', 81),
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
    ('900027', 'executive', 82)
),
empty_cases (target_no, evaluator_no, stage) as (
  values
    ('900011', '900011', 'self'),       -- 시연: 김민수 자기평가
    ('900011', '900010', 'leader'),     -- 시연: 박서준 → 김민수
    ('900011', '900028', 'executive'),  -- 시연: 이정호 → 김민수
    ('900013', '900013', 'self'),       -- scores.ts 미제출: 정다은 자기평가
    ('900027', '900027', 'self'),       -- scores.ts 미제출: 남궁현 자기평가
    ('900009', '900004', 'leader')      -- scores.ts 미제출: 한지훈 → 노지환
),
demo as (
  select c.id as case_id, c.stage, t.role as target_role, t.job_group,
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
 and q.question_set = case when d.stage = 'upward' then 'upward'
                           else d.job_group || '_' || d.target_role end
where q.type = 'choice'
   or d.stage = 'self'                                        -- 자기평가 서술형
   or (d.stage = 'leader' and d.target_role = 'member')       -- 팀원의 바로 위 평가자
   or (d.stage = 'executive' and d.target_role = 'leader');   -- 팀장의 바로 위 평가자

-- 4-2) 답을 넣은 평가 건을 "제출"로 바꾸기
with empty_cases (target_no, evaluator_no, stage) as (
  values
    ('900011', '900011', 'self'),       -- 시연: 김민수 자기평가
    ('900011', '900010', 'leader'),     -- 시연: 박서준 → 김민수
    ('900011', '900028', 'executive'),  -- 시연: 이정호 → 김민수
    ('900013', '900013', 'self'),       -- scores.ts 미제출: 정다은 자기평가
    ('900027', '900027', 'self'),       -- scores.ts 미제출: 남궁현 자기평가
    ('900009', '900004', 'leader')      -- scores.ts 미제출: 한지훈 → 노지환
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
begin
  select status || ' · '|| result_published into v_cycle from cycles where id = 1;
  select count(*),
         count(*) filter (where status = 'submitted'),
         count(*) filter (where status = 'not_started')
    into v_cases, v_sub, v_empty
  from cases where cycle_id = 1;
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

  if v_cycle <> 'before · false' or v_cases <> 102 or v_sub <> 96 or v_empty <> 6
     or v_bad > 0 or v_logs > 0 then
    raise exception '시연 초기화 확인 실패: 회차 %, 평가 건 %, 제출 %, 작성 전 %, 답·상태 어긋남 %, 남은 기록 %',
      v_cycle, v_cases, v_sub, v_empty, v_bad, v_logs;
  end if;
  raise notice '시연 초기화 완료: 회차 1 평가 전 · 미공개, 평가 건 102 (제출 96 · 작성 전 6)';
end
$$;

commit;
