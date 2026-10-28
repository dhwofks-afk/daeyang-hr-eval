-- 02_employees.sql : 직원 28명 (src/data/people.ts 27명 + 임원 1명). 모두 가짜 데이터.
-- 내부 번호(id)는 자동으로 붙는다. 다른 표는 내부 번호로 연결한다.
-- 직군: 생산 부서 = production(생산직), 경영기획부·영업부 = office(관리직)
-- 임원은 부서 표에 없는 "임원"이라 경영기획부 소속으로 넣고, 평가 제외(excluded)로 둔다.
--   → 임원 자신의 평가 건은 만들지 않고, 평가자 역할만 한다. 점수·등급·부서 인원에서 빠진다.
-- 로그인 계정 칸(auth_user_id)은 비워 두고, scripts/create-accounts.mjs가 채운다.

insert into employees (employee_no, name, department_id, position, role, job_group, excluded, status) values
  ('900001', '최정민', 1, '부장', 'leader', 'office', false, 'active'),
  ('900002', '이수아', 1, '대리', 'member', 'office', false, 'active'),
  ('900003', '장도윤', 1, '사원', 'member', 'office', false, 'active'),
  ('900004', '한지훈', 2, '차장', 'leader', 'office', false, 'active'),
  ('900005', '강수빈', 2, '사원', 'member', 'office', false, 'active'),
  ('900006', '서예린', 2, '주임', 'member', 'office', false, 'active'),
  ('900007', '문현우', 2, '과장', 'member', 'office', false, 'active'),
  ('900008', '임채원', 2, '대리', 'member', 'office', false, 'active'),
  ('900009', '노지환', 2, '사원', 'member', 'office', false, 'active'),
  ('900010', '박서준', 3, '과장', 'leader', 'production', false, 'active'),
  ('900011', '김민수', 3, '사원', 'member', 'production', false, 'active'),
  ('900012', '최유진', 3, '대리', 'member', 'production', false, 'active'),
  ('900013', '정다은', 3, '사원', 'member', 'production', false, 'active'),
  ('900014', '오승현', 3, '과장', 'member', 'production', false, 'active'),
  ('900015', '윤태호', 3, '과장', 'member', 'production', false, 'active'),
  ('900016', '송지아', 3, '대리', 'member', 'production', false, 'active'),
  ('900017', '권태양', 3, '주임', 'member', 'production', false, 'active'),
  ('900018', '배하늘', 3, '사원', 'member', 'production', false, 'active'),
  ('900019', '신동현', 3, '주임', 'member', 'production', false, 'active'),
  ('900020', '유가은', 3, '사원', 'member', 'production', false, 'active'),
  ('900021', '조민재', 3, '대리', 'member', 'production', false, 'active'),
  ('900022', '황보람', 3, '사원', 'member', 'production', false, 'active'),
  ('900023', '안성훈', 3, '차장', 'member', 'production', false, 'active'),
  ('900024', '전소윤', 3, '사원', 'member', 'production', false, 'active'),
  ('900025', '홍재원', 3, '주임', 'member', 'production', false, 'active'),
  ('900026', '고은비', 3, '사원', 'member', 'production', false, 'active'),
  ('900027', '남궁현', 3, '사원', 'member', 'production', false, 'active'),
  ('900028', '이정호', 1, '상무', 'executive', 'office', true, 'active');  -- 임원: 경영기획부 소속, 평가 제외(평가 대상 아님, 평가자 역할만)
