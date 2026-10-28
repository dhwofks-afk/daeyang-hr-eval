-- 004_service_role_grants.sql : 관리용 열쇠(service_role)의 표 권한 (docs/05-서버기반.md 4·6번)
--
-- 실행 방법: 003_functions.sql 다음에 SQL Editor에서 이 파일 전체를 실행한다. 새 프로젝트에서 한 번만.
--
-- 왜 필요한가
-- - 이 프로젝트는 새 표에 권한을 자동으로 주지 않는다. 002에서 authenticated(로그인한 사람)에게만 열었다.
-- - 그래서 관리용 열쇠도 직원 표를 못 읽어 계정 만들기 스크립트가 멈춘다 ("permission denied for table employees").
-- - service_role은 권한 규칙(RLS)은 건너뛰지만, 표 권한(grant)은 따로 있어야 한다.
--
-- 범위: scripts/create-accounts.mjs가 쓰는 만큼만 준다.
-- - 직원 표 읽기: 계정을 만들 직원을 고르고, 이미 연결됐는지 본다 (아래 6칸만)
-- - 직원 표 고치기: 로그인 계정 칸(auth_user_id) 하나만 채운다
-- - 다른 표, 직원 추가·삭제, 다른 칸 수정은 주지 않는다.
-- - 로그인 계정(auth.users) 만들기는 Supabase 로그인 기능이 하므로 여기서 권한을 주지 않는다.
-- 스크립트가 다른 표를 쓰게 되면 이 파일에 이유와 함께 추가한다.

grant select (id, employee_no, name, role, status, auth_user_id)
  on public.employees to service_role;

grant update (auth_user_id)
  on public.employees to service_role;
