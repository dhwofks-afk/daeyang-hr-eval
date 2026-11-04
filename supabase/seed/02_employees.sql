-- 02_employees.sql : 직원 30명 (src/data/people.ts 27명 + 임원 부서마다 1명 = 3명). 모두 가짜 데이터.
-- 내부 번호(id)는 자동으로 붙는다. 다른 표는 내부 번호로 연결한다.
-- 기술부(생산기술본부): 안성훈(팀장)·오승현·윤태호·송지아. 이정호가 생산부·기술부를 함께 임원평가한다 (11/4)
-- 임원은 본부 소속 (014). 이정호 = 생산기술본부, 백승민 = 기술영업본부, 윤재석 = 본부 없음(경영기획부).
-- 임원도 평가 대상이다: 같은 본부(본부 없는 부서는 본부 없는 임원) 팀원·팀장이 임원 상향 평가를 한다.
-- 로그인 계정 칸(auth_user_id)은 비워 두고, scripts/create-accounts.mjs가 채운다.

insert into employees (employee_no, name, department_id, position, role, excluded, status) values
  ('900001', '최정민', 1, '부장', 'leader', false, 'active'),
  ('900002', '이수아', 1, '대리', 'member', false, 'active'),
  ('900003', '장도윤', 1, '사원', 'member', false, 'active'),
  ('900004', '한지훈', 2, '차장', 'leader', false, 'active'),
  ('900005', '강수빈', 2, '사원', 'member', false, 'active'),
  ('900006', '서예린', 2, '주임', 'member', false, 'active'),
  ('900007', '문현우', 2, '과장', 'member', false, 'active'),
  ('900008', '임채원', 2, '대리', 'member', false, 'active'),
  ('900009', '노지환', 2, '사원', 'member', false, 'active'),
  ('900010', '박서준', 3, '과장', 'leader', false, 'active'),
  ('900011', '김민수', 3, '사원', 'member', false, 'active'),
  ('900012', '최유진', 3, '대리', 'member', false, 'active'),
  ('900013', '정다은', 3, '사원', 'member', false, 'active'),
  ('900014', '오승현', 4, '과장', 'member', false, 'active'),
  ('900015', '윤태호', 4, '과장', 'member', false, 'active'),
  ('900016', '송지아', 4, '대리', 'member', false, 'active'),
  ('900017', '권태양', 3, '주임', 'member', false, 'active'),
  ('900018', '배하늘', 3, '사원', 'member', false, 'active'),
  ('900019', '신동현', 3, '주임', 'member', false, 'active'),
  ('900020', '유가은', 3, '사원', 'member', false, 'active'),
  ('900021', '조민재', 3, '대리', 'member', false, 'active'),
  ('900022', '황보람', 3, '사원', 'member', false, 'active'),
  ('900023', '안성훈', 4, '차장', 'leader', false, 'active'),
  ('900024', '전소윤', 3, '사원', 'member', false, 'active'),
  ('900025', '홍재원', 3, '주임', 'member', false, 'active'),
  ('900026', '고은비', 3, '사원', 'member', false, 'active'),
  ('900027', '남궁현', 3, '사원', 'member', false, 'active'),
  ('900028', '이정호', 3, '상무', 'executive', false, 'active'),  -- 임원: 생산기술본부 (부서 칸은 생산부)
  ('900029', '윤재석', 1, '이사', 'executive', false, 'active'),      -- 임원: 본부 없음 (경영기획부)
  ('900030', '백승민', 2, '이사', 'executive', false, 'active');      -- 임원: 기술영업본부 (부서 칸은 기술영업부)

-- 임원의 본부 (014)
update employees set headquarters_id = 2 where employee_no = '900028';
update employees set headquarters_id = 1 where employee_no = '900030';
