-- 002_policies.sql : 권한 규칙 (docs/05-서버기반.md 5번)
--
-- 실행 방법: 001_tables.sql 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
-- 원칙: 001에서 모든 표를 잠갔다. 여기서는 "로그인한 사람(authenticated)"에게 필요한 만큼만 연다.
--       로그인 전(anon)에게는 아무것도 열지 않는다.
-- 관리자 표시는 로그인 계정의 app_metadata.role = 'admin'. 계정 만들기 스크립트(서버)만 붙일 수 있다.


-- ---------------------------------------------------------------
-- 보조 함수 (규칙 안에서 쓴다)
-- security definer: 잠긴 표를 함수 안에서만 읽는다. 결과로 사번은 내보내지 않는다.
-- ---------------------------------------------------------------

-- 지금 로그인한 사람이 관리자인가
create or replace function public.is_admin()
returns boolean
language sql stable
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;

-- 지금 로그인한 직원의 내부 번호 (퇴사자·관리자·로그인 전이면 null → 아무것도 못 봄)
create or replace function public.my_employee_id()
returns integer
language sql stable security definer
set search_path = ''
as $$
  select e.id from public.employees e
  where e.auth_user_id = auth.uid() and e.status = 'active'
$$;

-- 이 평가 건이 "내가 평가자이고 아직 고칠 수 있는 상태"인가 (작성 전·작성 중·반려)
create or replace function public.case_is_editable_by_me(p_case_id integer)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.cases c
    where c.id = p_case_id
      and c.evaluator_id = public.my_employee_id()
      and c.status in ('not_started', 'in_progress', 'returned')
  )
$$;

-- 이 평가 건의 답을 내가 읽을 수 있는가
-- 1) 내가 평가자인 건
-- 2) 예외: 내가 팀장·임원 단계로 평가하는 사람의 "자기평가" 답 (서술형 점수를 정하려면 필요)
--    상향 평가자(팀원)는 팀장의 자기평가를 못 본다. 팀장은 자기에 대한 상향 평가를 못 본다.
create or replace function public.can_read_case_answers(p_case_id integer)
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
    where self_case.id = p_case_id
      and self_case.stage = 'self'
      and mine.evaluator_id = public.my_employee_id()
      and mine.stage in ('leader', 'executive')
  )
$$;

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.my_employee_id() from public, anon;
revoke execute on function public.case_is_editable_by_me(integer) from public, anon;
revoke execute on function public.can_read_case_answers(integer) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_employee_id() to authenticated;
grant execute on function public.case_is_editable_by_me(integer) to authenticated;
grant execute on function public.can_read_case_answers(integer) to authenticated;


-- ---------------------------------------------------------------
-- 표 접근 권한 (어떤 동작을 할 수 있는지). 누구의 어떤 줄인지는 아래 규칙(policy)이 정한다.
-- ---------------------------------------------------------------
revoke all on all tables in schema public from anon;

grant select, update            on public.departments   to authenticated;
grant select, update            on public.cycles        to authenticated;
grant select, insert, update, delete on public.questions to authenticated;
grant select, insert, update    on public.employees     to authenticated;  -- 삭제 없음 (퇴사 처리)
grant select, insert            on public.cases         to authenticated;
grant update (status, opinion, submitted_at) on public.cases to authenticated;  -- 대상·평가자·단계는 못 바꿈
grant select, insert            on public.answers       to authenticated;
-- 답 저장은 "있으면 고치고 없으면 추가"(upsert)라 연결 칸도 update 권한이 필요하다. 규칙이 내 평가 건으로 제한한다.
grant update (case_id, question_id, score, essay, updated_at) on public.answers to authenticated;
grant select, insert            on public.final_results to authenticated;
grant select                    on public.adjustments   to authenticated;
grant insert (cycle_id, employee_id, before_score, after_score, reason)
                                on public.adjustments   to authenticated;  -- 보정한 사람·시각은 서버가 채움 (003)


-- ---------------------------------------------------------------
-- 부서 · 평가 설정 · 문항: 로그인한 사람은 읽기만, 관리자는 쓰기
-- ---------------------------------------------------------------
create policy "부서: 로그인한 사람 읽기" on public.departments
  for select to authenticated using (true);
create policy "부서: 관리자 수정" on public.departments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "평가 설정: 로그인한 사람 읽기" on public.cycles
  for select to authenticated using (true);
create policy "평가 설정: 관리자 수정" on public.cycles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "문항: 로그인한 사람 읽기" on public.questions
  for select to authenticated using (true);
create policy "문항: 관리자 추가" on public.questions
  for insert to authenticated with check (public.is_admin());
create policy "문항: 관리자 수정" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "문항: 관리자 삭제" on public.questions
  for delete to authenticated using (public.is_admin());


-- ---------------------------------------------------------------
-- 직원: 직원은 직접 못 읽음 (003의 서버 함수로만). 관리자는 읽기·쓰기
-- ---------------------------------------------------------------
create policy "직원: 관리자 읽기" on public.employees
  for select to authenticated using (public.is_admin());
create policy "직원: 관리자 추가" on public.employees
  for insert to authenticated with check (public.is_admin());
create policy "직원: 관리자 수정" on public.employees
  for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------
-- 평가 건: 직원은 내가 평가자인 건만. 상태·의견만 바꾸고 제출 후 잠김. 관리자는 전체 (반려 포함)
-- ---------------------------------------------------------------
create policy "평가 건: 내가 평가자인 건 읽기" on public.cases
  for select to authenticated using (evaluator_id = public.my_employee_id());
create policy "평가 건: 관리자 읽기" on public.cases
  for select to authenticated using (public.is_admin());

create policy "평가 건: 관리자 추가" on public.cases
  for insert to authenticated with check (public.is_admin());

-- 고칠 수 있는 상태(작성 전·작성 중·반려)일 때만, 바꾼 뒤 상태는 작성 중 또는 제출만
create policy "평가 건: 평가자 작성·제출" on public.cases
  for update to authenticated
  using (evaluator_id = public.my_employee_id()
         and status in ('not_started', 'in_progress', 'returned'))
  with check (evaluator_id = public.my_employee_id()
              and status in ('in_progress', 'submitted'));
create policy "평가 건: 관리자 수정 (반려)" on public.cases
  for update to authenticated using (public.is_admin()) with check (public.is_admin());


-- ---------------------------------------------------------------
-- 답: 내 평가 건의 답만 쓰기 (제출 후 못 고침, 반려되면 다시 가능)
--     읽기는 내 평가 건 + 내가 평가하는 사람의 자기평가 답. 관리자는 전체 읽기
-- ---------------------------------------------------------------
create policy "답: 읽기" on public.answers
  for select to authenticated using (public.can_read_case_answers(case_id));
create policy "답: 관리자 읽기" on public.answers
  for select to authenticated using (public.is_admin());

create policy "답: 내 평가 건에 쓰기" on public.answers
  for insert to authenticated with check (public.case_is_editable_by_me(case_id));
create policy "답: 내 평가 건 고치기" on public.answers
  for update to authenticated
  using (public.case_is_editable_by_me(case_id))
  with check (public.case_is_editable_by_me(case_id));


-- ---------------------------------------------------------------
-- 확정 결과: 직원은 직접 못 읽음 (003의 "내 결과 가져오기"로만). 관리자는 전체
-- ---------------------------------------------------------------
create policy "확정 결과: 관리자 읽기" on public.final_results
  for select to authenticated using (public.is_admin());
create policy "확정 결과: 관리자 추가 (결과 공개)" on public.final_results
  for insert to authenticated with check (public.is_admin());


-- ---------------------------------------------------------------
-- 보정 기록: 직원은 못 봄. 관리자는 읽기 + 새 줄 추가만 (고치기·지우기 규칙 없음 = 불가)
-- ---------------------------------------------------------------
create policy "보정 기록: 관리자 읽기" on public.adjustments
  for select to authenticated using (public.is_admin());
create policy "보정 기록: 관리자 추가" on public.adjustments
  for insert to authenticated with check (public.is_admin());
