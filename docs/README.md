# 대양롤랜트 인사평가 웹앱 — 개발 안내

엑셀·종이로 하던 인사평가를 웹으로 옮긴 시스템입니다. 이 문서는 시스템을 넘겨받아 운영·수정할 분을 위한 첫 안내입니다.

## 1. 시스템 개요
- **직원(팀원·팀장·임원)**: 휴대폰 웹으로 로그인해 자기평가 · 팀장평가 · 임원평가 · 상향평가 · 임원상향평가를 작성·제출합니다. 자기평가 끝에 건의(선택)와 만족도를 냅니다.
- **관리자(인사팀장 1명)**: PC로 평가를 만들고(문항·평가 관계), 시작하고, 응답 현황을 보고 반려하며, 부서 KPI·비율·보정을 거쳐 결과를 확정하고 리포트를 출력합니다.
- 결과는 관리자만 봅니다 (직원용 결과 화면 없음). 상향평가·건의·만족도는 익명입니다.
- 평가 규칙(단계·비율·용어)은 저장소 맨 위 `CLAUDE.md`의 "6. 용어 사전"에 모여 있습니다.

## 2. 기술 구성
| 부분 | 쓰는 것 | 저장소 위치 |
|---|---|---|
| 화면 | React 19 + Vite + TypeScript, react-router | `src/` |
| 저장소·로그인 | Supabase (PostgreSQL, 권한 규칙 RLS, 로그인) | `supabase/migrations/` (표·규칙·함수), `supabase/seed/` (처음 데이터) |
| 명단 반영 | Supabase Edge Function `import-employees` | `supabase/functions/import-employees/` |
| 계정 만들기 | Node 스크립트 (관리자 PC에서만) | `scripts/create-accounts.mjs` |
| 배포 | Render (Static Site, main에 올리면 자동 배포) | `docs/14-배포.md` |

도구: Node.js 22, pnpm 10 (npm·yarn은 쓰지 않음). 실행 `pnpm dev` → http://localhost:8443, 빌드 `pnpm build`.

## 3. 화면 목록과 담당 문서
| 화면 | 주소 | 문서 |
|---|---|---|
| 로그인 | `/login` | 16-사용설명서 |
| 직원: 평가 목록·작성 | `/my/evaluations` | 06-평가작성, 12-평가작성추가 (건의·만족도 제출) |
| 대시보드 | `/admin` | 04-대시보드 |
| 사람·조직 > 조직도 | `/admin/people/org-chart` | 13-조직도 |
| 사람·조직 > 평가 관계 | `/admin/people/relations` | 09-평가관계 |
| 평가 설계 > 평가 목록 · 문항 편집 | `/admin/design/list`, `/admin/design/questions` | 16-사용설명서, 10-데이터설계 |
| 진행 관리 > 응답 현황 · 반려 현황 | `/admin/progress`, `/admin/progress/returns` | 08-진행관리 |
| 점수·보정 > 평가 결과 · KPI 반영 · 최종 점수 보정 | `/admin/scores/...` | 02-점수보정 |
| 리포트 (개인·전체, 인쇄) | `/admin/reports` | 03-리포트 |
| 직원 의견 > 건의함 · 만족도 | `/admin/suggestions`, `/admin/satisfaction` | 17-건의함, 12-평가작성추가 |
| 데이터 관리 (명단 올리기·전체 내려받기·전체 삭제) | `/admin/data` | 11-데이터관리 |

공통 참고: 표·칸·계산 규칙은 `10-데이터설계`, 서버 함수·잠금은 `07-서버추가`, 배포는 `14-배포`, 전체 사용법은 `16-사용설명서`.
`01-골격`, `05-서버기반`은 초기 기록 문서라 현재 기준과 다를 수 있습니다.

## 4. 처음 설치 순서 (회사 명의 Supabase·Render)
1. **Supabase 프로젝트 만들기** (회사 계정). Project URL·공개용 열쇠(anon/publishable)·관리용 열쇠(service_role/secret)를 확인합니다.
2. **표·규칙·함수 만들기**: Supabase 웹 > SQL Editor에서 `supabase/migrations/001`부터 `018`까지 번호 순서대로 파일 전체를 실행합니다.
   - 각 파일 맨 아래 주석의 **확인 쿼리**를 따로 돌려 실제로 들어갔는지 봅니다 ("Success"만 믿지 않습니다).
   - 표·권한은 웹 화면에서 직접 만들지 않고 항상 SQL 파일로 만듭니다.
3. **처음 데이터 넣기** (`supabase/seed/`):
   - `01_departments_cycle.sql` 본부·부서·첫 평가 → `03_questions.sql` 문항 3세트(팀원·팀장·상향)
   - `02_employees.sql`·`04_cases.sql`·`05_demo_answers.sql`·`90_demo_reset.sql`은 **시연용 가짜 직원·답**입니다. 실제 운영에서는 실행하지 않습니다.
   - 실제 직원 명단은 관리자 화면 > 데이터 관리 > 명단 올리기(엑셀/CSV)로만 넣습니다.
4. **로컬 설정 파일**: 저장소 맨 위에 `.env.local`을 만들고 세 줄을 넣습니다 (Git에 올리지 않음, `.gitignore`에 들어 있음).
   `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
5. **관리자 계정**: `node --env-file=.env.local scripts/create-accounts.mjs --admin` (비밀번호는 실행할 때 직접 입력, 저장하지 않음)
6. **Edge Function 배포**: Supabase 웹 > Edge Functions에 `import-employees`를 만들고 `supabase/functions/import-employees/index.ts` 내용을 붙여 넣습니다 ("Verify JWT" 켬). 열쇠는 Supabase가 함수 안에 자동으로 넣어 줍니다.
7. **직원 명단·계정**: 관리자로 로그인 → 데이터 관리 > 명단 올리기. 새 직원 계정은 함수가 함께 만듭니다 (아이디 `사번@daeyang-hr.local`, 첫 비밀번호 = 사번). 따로 만들 때는 `create-accounts.mjs --all`.
8. **Render 배포**: Static Site, Build Command `pnpm install && pnpm build`, Publish Directory `dist`, Redirects/Rewrites `/*` → `/index.html` (Rewrite), 환경 변수는 `VITE_SUPABASE_URL`·`VITE_SUPABASE_ANON_KEY` 두 개만. 자세한 내용은 `14-배포`.
9. Supabase > Authentication > URL Configuration의 Site URL을 Render 주소로 맞춥니다.

## 5. AI(Claude Code)로 고칠 때
- 저장소 맨 위 `CLAUDE.md`는 Claude Code가 작업을 시작할 때 자동으로 읽는 규칙 파일입니다. 프로젝트 소개, 작업 방식(고치기 전 계획 보고, 범위, 파일 경계), 보안 규칙, 코드·스타일 규칙, 용어 사전, 실행 방법이 들어 있습니다.
- 규칙이나 용어가 바뀌면 **코드보다 먼저 CLAUDE.md와 해당 docs 문서를 고칩니다**. 문서 우선순위는 docs → CLAUDE.md → 기존 코드입니다.
- 요청할 때는 화면(문서 번호)·바꿀 내용·확인 방법을 함께 적으면 정확합니다.

프롬프트 예시
1. `docs/02-점수보정.md 기준으로 평가 결과 화면에 "부서 평균" 열을 추가하고 싶어. 먼저 어떤 파일을 어떻게 바꿀지 계획만 보고해 줘. 승인하면 진행하고, 끝나면 pnpm build와 pnpm exec tsc --noEmit 결과를 알려 줘.`
2. `회사 평가표가 바뀌었어: 팀원 평가표 근무태도 20 → 15, 조직문화 15 → 20. 새 SQL 파일(019, 여러 번 실행해도 안전, 확인 쿼리 포함)과 seed 03, CLAUDE.md 용어 사전 해당 줄을 고쳐 줘. SQL 실행은 내가 할게.`
3. `직원 평가 작성 화면에서 글씨가 작다는 의견이 있어. 휴대폰 너비(375px)에서 문항 글씨를 키워 줘. 관리자 화면은 건드리지 말고, 바꾼 뒤 휴대폰 너비 화면으로 확인해 줘.`

## 6. 보안 주의
- **관리용 열쇠(service_role / secret)** 는 모든 권한 규칙을 건너뜁니다. `.env.local`(관리자 PC)과 Supabase 안에만 두고, 코드·Git·채팅(AI 포함)·메신저·Render 환경 변수에 넣지 않습니다. 이름에 `VITE_`를 붙이면 화면 코드에 실려 공개되므로 절대 붙이지 않습니다.
- 화면에는 공개용 열쇠(anon/publishable)만 씁니다. 데이터 보호는 Supabase 권한 규칙(RLS)이 맡습니다.
- 직원 첫 비밀번호는 사번입니다. 운영 전에 비밀번호 변경 안내 또는 정책을 정하는 것을 권합니다.
- 실제 직원 정보는 코드·문서·seed에 넣지 않습니다. 실제 명단은 관리자 화면의 명단 올리기로만 들어갑니다.
- 주민등록번호·전화번호·생년월일·연봉 입력란은 만들지 않습니다.
- 검색 노출 차단(robots `index: false`)은 끄지 않습니다.
- 열쇠가 밖으로 나갔다고 의심되면 Supabase에서 열쇠를 새로 만들고(rotate) `.env.local`·Edge Function 설정을 바꿉니다.
