-- 04_cases.sql : 평가 건 만들기. 회차 1.
-- 규칙은 서버 함수 rule_relations_base()(011) 한 곳에만 둔다: 자기 / 팀장 / 임원(같은 부서 임원) / 상향 / 임원 상향.
-- 예상 건수: 자기 27 + 팀장 평가 24 + 임원 평가 27 + 상향 24 + 임원 상향 27 = 129건
select create_cases(1);

-- 검사: 129건이 아니면 오류
do $$
declare v_count integer;
begin
  select count(*) into v_count from cases where cycle_id = 1;
  if v_count <> 129 then
    raise exception '평가 건이 %건입니다 (129건이어야 함)', v_count;
  end if;
end
$$;
