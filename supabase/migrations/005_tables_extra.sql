-- 005_tables_extra.sql : 새 표 5개 + 권한 규칙 (docs/07-서버추가.md 2번, docs/10-데이터설계.md 9~12번)
--
-- 실행 방법: 004 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- 실행 후 확인 쿼리로 표·규칙이 실제로 생겼는지 반드시 확인한다.
-- 원칙: 002와 같다. 로그인 전(anon)에게는 아무것도 열지 않고, 로그인한 사람에게 필요한 만큼만 연다.


-- ---------------------------------------------------------------
-- 보조 함수: 이 회차가 "평가 중"이고 결과 공개 전인가 (자기관찰·건의·만족도를 쓸 수 있는 때)
-- ---------------------------------------------------------------
create or replace function public.cycle_is_open(p_cycle_id integer)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cycles c
    where c.id = p_cycle_id and c.status = 'in_progress' and not c.result_published
  )
$$;

revoke execute on function public.cycle_is_open(integer) from public, anon;
grant execute on function public.cycle_is_open(integer) to authenticated;


-- ---------------------------------------------------------------
-- 9. return_logs (반려 기록) — 추가만. 반려 함수(006 return_case)로만 쌓인다
-- ---------------------------------------------------------------
create table return_logs (
  id          integer generated always as identity primary key,
  cycle_id    integer not null references cycles (id),                     -- 회차
  case_id     integer not null references cases (id),                      -- 평가 건
  reason      text not null check (length(trim(reason)) > 0),              -- 사유 (필수)
  returned_by text not null,                                               -- 처리한 사람 (서버가 채움)
  returned_at timestamptz not null default now()                           -- 처리 시각 (서버가 채움)
);
comment on table return_logs is '반려 기록';
create index return_logs_case_idx on return_logs (case_id, returned_at);


-- ---------------------------------------------------------------
-- 10. self_observations (자기관찰) — 본인과 관리자만 읽는다. 팀장·임원은 못 본다
-- ---------------------------------------------------------------
create table self_observations (
  cycle_id       integer not null references cycles (id),        -- 회차
  employee_id    integer not null references employees (id),     -- 직원 (내부 번호)
  workload       smallint not null check (workload between 1 and 5),      -- 업무량
  difficulty     smallint not null check (difficulty between 1 and 5),    -- 난이도
  aptitude       smallint not null check (aptitude between 1 and 5),      -- 적성
  satisfaction   smallint not null check (satisfaction between 1 and 5),  -- 만족도
  relationships  smallint not null check (relationships between 1 and 5), -- 대인관계
  transfer_wish  smallint not null check (transfer_wish between 1 and 4), -- 이동 희망
  wish_department text,                                          -- 희망 부서
  main_work      text,                                           -- 현재 주요 업무
  other_opinion  text,                                           -- 기타 의견
  updated_at     timestamptz not null default now(),
  primary key (cycle_id, employee_id)
);
comment on table self_observations is '자기관찰';


-- ---------------------------------------------------------------
-- 11. suggestions (건의) — 작성자·날짜·시각 칸 없음 (관리자도 누가 썼는지 모른다)
-- 번호는 순서가 없는 무작위 값(uuid)이라 제출 순서도 드러나지 않는다
-- ---------------------------------------------------------------
create table suggestions (
  id       uuid primary key default gen_random_uuid(),
  cycle_id integer not null references cycles (id),                 -- 회차
  content  text not null check (length(trim(content)) > 0)          -- 내용
);
comment on table suggestions is '건의 (익명)';


-- ---------------------------------------------------------------
-- 12. satisfaction (만족도 내용) + satisfaction_done (만족도 제출 여부)
-- 내용 표에는 작성자·날짜·시각이 없다. 한 사람이 한 번만 내도록 제출 여부는 따로 둔다.
-- 둘은 006의 submit_satisfaction이 한 번에 저장한다
-- ---------------------------------------------------------------
create table satisfaction (
  id       uuid primary key default gen_random_uuid(),
  cycle_id integer not null references cycles (id),                 -- 회차
  score    smallint not null check (score between 1 and 5),         -- 점수
  comment  text                                                     -- 의견 (선택)
);
comment on table satisfaction is '만족도 (익명)';

create table satisfaction_done (
  cycle_id    integer not null references cycles (id),              -- 회차
  employee_id integer not null references employees (id),           -- 직원 (내부 번호)
  primary key (cycle_id, employee_id)
);
comment on table satisfaction_done is '만족도 제출 여부';


-- ---------------------------------------------------------------
-- 8. adjustments (보정 기록) 변경: 보정 후가 비어 있으면 보정 취소 (scoring.ts와 같은 규칙)
-- (0~100 검사는 그대로. 빈 값은 검사를 통과한다)
-- ---------------------------------------------------------------
alter table adjustments alter column after_score drop not null;


-- ---------------------------------------------------------------
-- 잠그기 + 표 접근 권한
-- ---------------------------------------------------------------
alter table return_logs       enable row level security;
alter table self_observations enable row level security;
alter table suggestions       enable row level security;
alter table satisfaction      enable row level security;
alter table satisfaction_done enable row level security;

revoke all on return_logs, self_observations, suggestions, satisfaction, satisfaction_done
  from public, anon;

grant select on public.return_logs to authenticated;                       -- 추가는 함수로만
grant select, insert on public.self_observations to authenticated;
grant update (workload, difficulty, aptitude, satisfaction, relationships, transfer_wish,
              wish_department, main_work, other_opinion, updated_at)
  on public.self_observations to authenticated;                            -- 회차·직원은 못 바꿈
grant insert (cycle_id, content) on public.suggestions to authenticated;   -- 번호는 서버가 정함
grant select on public.suggestions to authenticated;                       -- 규칙이 관리자만 허락
grant select on public.satisfaction to authenticated;                      -- 추가는 함수로만
grant select on public.satisfaction_done to authenticated;                 -- 추가는 함수로만


-- ---------------------------------------------------------------
-- 권한 규칙
-- ---------------------------------------------------------------
create policy "반려 기록: 관리자 읽기" on public.return_logs
  for select to authenticated using (public.is_admin());

create policy "자기관찰: 본인 읽기" on public.self_observations
  for select to authenticated using (employee_id = public.my_employee_id());
create policy "자기관찰: 관리자 읽기" on public.self_observations
  for select to authenticated using (public.is_admin());
create policy "자기관찰: 본인 쓰기 (평가 중·공개 전)" on public.self_observations
  for insert to authenticated
  with check (employee_id = public.my_employee_id() and public.cycle_is_open(cycle_id));
create policy "자기관찰: 본인 고치기 (평가 중·공개 전)" on public.self_observations
  for update to authenticated
  using (employee_id = public.my_employee_id() and public.cycle_is_open(cycle_id))
  with check (employee_id = public.my_employee_id() and public.cycle_is_open(cycle_id));

create policy "건의: 직원 추가 (평가 중·공개 전)" on public.suggestions
  for insert to authenticated
  with check (public.my_employee_id() is not null and public.cycle_is_open(cycle_id));
create policy "건의: 관리자 읽기" on public.suggestions
  for select to authenticated using (public.is_admin());

create policy "만족도: 관리자 읽기" on public.satisfaction
  for select to authenticated using (public.is_admin());

create policy "만족도 제출 여부: 본인 읽기" on public.satisfaction_done
  for select to authenticated using (employee_id = public.my_employee_id());
create policy "만족도 제출 여부: 관리자 읽기" on public.satisfaction_done
  for select to authenticated using (public.is_admin());
