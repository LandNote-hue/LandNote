# LandNote Supabase 설정 가이드

## 1. 프로젝트 생성

1. [https://supabase.com](https://supabase.com) 로그인 → **New project**
2. Organization 선택 → 프로젝트 이름: `landnote`
3. Database Password 저장 (분실 시 복구 어려움)
4. Region: **Northeast Asia (Seoul)** 권장
5. **Create new project** (1~2분 대기)

---

## 2. SQL 실행

1. Supabase Dashboard → **SQL Editor** → **New query**
2. 아래 파일 내용을 **순서대로** 붙여넣고 **Run**:

| 순서 | 파일 |
|------|------|
| 1 | `supabase/migrations/001_initial.sql` |
| 2 | `supabase/migrations/002_properties_unique.sql` |
| 3 | `supabase/migrations/003_customers_unique.sql` |
| 4 | `supabase/migrations/004_profiles_extend.sql` |
| 5 | `supabase/migrations/005_user_terms_consents.sql` |
| 6 | `supabase/migrations/006_data_isolation.sql` |
| 7 | `supabase/migrations/007_companies_rbac_foundation.sql` |
| 8 | `supabase/migrations/008_b2b_company_rls.sql` |
| 9 | `supabase/migrations/009_company_invites.sql` |
| 10 | `supabase/migrations/010_signup_fix.sql` *(가입 500/`{}` 오류 시)* |
| 11 | `supabase/migrations/011_b2b2c_solo_business.sql` |
| 12 | `supabase/migrations/012_account_deletion.sql` |
| 13 | `supabase/migrations/013_oauth_rejoin_onboarding.sql` *(구글 탈퇴 후 재가입 유도)* |
| 14 | `supabase/migrations/014_signup_schema_repair.sql` *(가입 `{}`/500 오류 복구 — **필수**)* |
| 15 | `supabase/migrations/015_deletion_and_oauth_gate.sql` *(탈퇴·OAuth 가입 절차 보완)* |
| 16 | `supabase/migrations/016_company_member_permissions.sql` *(CEO 중앙 권한 — 017에서 sharing_policies로 통합)* |
| 17 | `supabase/migrations/017_sharing_policies_ceo_rbac.sql` *(sharing_policies: member_id + resource_type + can_view/can_edit + RLS)* |
| 18 | `supabase/migrations/018_invite_preview_rpc.sql` *(사원 초대 가입 페이지 회사명 미리보기 RPC)* |
| 19 | `supabase/migrations/019_ceo_signup_invite_guard.sql` *(회사명 CEO 가입 시 invite_token 무시 — 직원 오가입 방지)* |
| 20 | `supabase/migrations/020_oauth_signup_invite_guard.sql` *(OAuth 가입 완료 RPC 동일 가드)* |
| 21 | `supabase/migrations/021_deletion_invite_email_cleanup.sql` *(탈퇴 시 invited_email 초대 레코드 삭제)* |
| 22 | `supabase/migrations/022_invite_history_and_transfer.sql` *(초대 이력·기존 회원 소속 이관)* |
| 23 | `supabase/migrations/023_fix_member_dashboard_joined_at.sql` *(직원 목록 RPC joined_at 오타 수정)* |
| 24 | `supabase/migrations/024_invite_history_dedupe_by_email.sql` *(초대 이력: 이메일당 최종 발송 1건)* |
| 25 | `supabase/migrations/025_invite_revoke_and_remove_member.sql` *(초대 취소·직원 팀 제거)* |
| 26 | `supabase/migrations/026_backfill_company_id.sql` *(공유 RLS용 company_id 백필)* |
| 27 | `supabase/migrations/027_share_null_company_id.sql` *(company_id NULL 공유 허용 + 자동 채움)* |
| 28 | `supabase/migrations/028_share_select_rls_unify.sql` *(매물·일정·통화 SELECT/쓰기 RLS 통일 — **직원 공유 필수**)* |
| 29 | `supabase/migrations/029_property_photos_storage.sql` *(매물 사진 Storage)* |
| 30 | `supabase/migrations/030_property_disco_url.sql` *(매물 디스코 상세 링크 `disco_url`)* |
| 31 | `supabase/migrations/031_upgrade_solo_to_business.sql` *(개인→회사형 전환 RPC)* |

에러 없이 `Success`가 나오면 테이블·RLS·트리거가 생성된 것입니다.

---

## 3. API 키를 .env.local에 추가

Dashboard → **Project Settings** → **API**

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_AUTH_DEV_BYPASS=false
```

> `anon` 키만 프론트에 넣습니다. `service_role` 키는 **절대** Vite env에 넣지 마세요.

---

## 4. Google OAuth (먼저 연동)

### 4-A. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → 프로젝트 생성
2. **APIs & Services** → **OAuth consent screen** → External → 앱 이름 `LandNote`
3. **Credentials** → **Create Credentials** → **OAuth client ID**
4. Application type: **Web application**
5. Authorized redirect URIs에 Supabase 콜백 URL 추가:

```
https://xxxxxxxx.supabase.co/auth/v1/callback
```

6. **Client ID**, **Client Secret** 복사

### 4-B. Supabase Auth 설정

1. Dashboard → **Authentication** → **Providers** → **Google** → Enable
2. Client ID / Client Secret 붙여넣기 → Save

### 4-C. Redirect URL 허용

**Authentication** → **URL Configuration**

| 항목 | 값 (개발) |
|------|-----------|
| Site URL | `http://localhost:5175` |
| Redirect URLs | `http://localhost:5175/**` |

배포 후 Render URL도 추가 (예: `https://landnote.onrender.com/**`)

---

## 5. 이메일 로그인 (선택)

**Authentication** → **Providers** → **Email** → Enable

- Confirm email: 개발 중에는 OFF 가능, **운영 시 ON 권장**

**Authentication** → **Email Templates** → **Confirm signup**

- 제목: `supabase/email-templates/confirm-signup.subject.txt` 붙여넣기
- 본문: `supabase/email-templates/confirm-signup.html` 전체 붙여넣기
- 링크 변수: `{{ .ConfirmationURL }}` (Supabase 표준)
- 발신인 이름: **LandNote** (SMTP Settings)
- 상세: `supabase/email-templates/README.md`

**Authentication** → **URL Configuration** — Redirect URLs:

```
http://localhost:5175/**
http://localhost:5175/login
http://localhost:5175/reset-password
```

배포 URL도 동일하게 추가 (예: `https://landnote.onrender.com/**`)

**중요 (비밀번호 재설정):**  
Site URL이 `localhost`로 남아 있으면 재설정 메일 링크가 로컬로 리다이렉트되어 **배포 환경에서 재설정이 실패**합니다.  
운영 Site URL을 배포 도메인으로 바꾸고, Redirect URLs에 배포 `/reset-password`를 포함하세요.

**Authentication** → **Email Templates** → **Reset password**도 Confirm signup과 같이 국문 템플릿을 적용하는 것을 권장합니다.

**네이버·다음 등 국내 메일:** Supabase 기본 발신(SMTP) 메일은 스팸·미도착이 잦습니다. 운영에서는 **Custom SMTP**(Resend, SendGrid, AWS SES 등) 설정을 권장합니다.

**Reset password 템플릿**

- 제목: `supabase/email-templates/reset-password.subject.txt`
- 본문: `supabase/email-templates/reset-password.html`
- Dashboard → Authentication → Email Templates → **Reset password** 에 붙여넣기

**긴급 복구 (메일 미도착 시)**

1. Dashboard → Authentication → Users → 해당 사용자 → **Send password recovery** 또는 비밀번호 직접 설정
2. 또는 `auth.admin.updateUserById` 로 임시 비밀번호 발급 후 오프라인 전달
3. `email rate limit exceeded` 가 나오면 한동안 메일 API 발송이 막힌 상태입니다 (기본 SMTP 한도). Custom SMTP 연결 후 재시도하세요.

**Authentication** → **URL Configuration** — 비밀번호 재설정:

### 자동 로그인

로그인 화면 **자동 로그인** 체크 시 세션이 `localStorage`에 저장되어 브라우저를 닫아도 유지됩니다.  
체크 해제 시 `sessionStorage`만 사용하므로 **브라우저(탭) 종료 시 로그아웃**됩니다.

---

## 6. B2B 팀 초대 점검 (007~009 적용 후)

```bash
npm run verify:b2b
```

- 스키마·RPC 존재 확인 + CEO 초대 → 멤버 가입 E2E 자동 테스트
- `SUPABASE_SERVICE_ROLE_KEY` 필요 (`.env.local`)
- 009만 RPC가 없으면 `009_company_invites.sql` 실행 (최초) 또는 `009_company_invites_rpc_repair.sql` (재실행·복구)

---

## 7. 동작 확인

```bash
npm run dev
```

1. 브라우저에서 `http://localhost:5175` 접속
2. **Google로 계속** 클릭 → 로그인
3. 매물 관리 화면에서 데이터 확인
4. Supabase **Table Editor** → `properties` 테이블에 행이 생기는지 확인

---

## 8. Vercel 배포 (웹 + BFF 서버리스)

LandNote는 Vite 정적 프론트 + Express BFF를 **같은 Vercel 프로젝트**에 올립니다.  
`/api/*` · `/juso-return.html` 은 `api/index.js` 서버리스로, 나머지는 `dist/` SPA로 제공됩니다.

### 8-A. Vercel 프로젝트 연결

1. [vercel.com](https://vercel.com) → **Add New… → Project**
2. GitHub **LandNote-hue/LandNote** 저장소 Import
3. Framework Preset: **Vite** (자동 감지되면 그대로)
4. Build Command: `npm run build` / Output: `dist` (`vercel.json`에 이미 정의)
5. **Deploy**

### 8-B. Environment Variables

Project → **Settings → Environment Variables** 에 `.env.example` 값을 넣습니다.  
`Production` / `Preview` 모두 권장.

| 변수 | 비고 |
|------|------|
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | 필수 |
| `VITE_AUTH_DEV_BYPASS` | **`false`** |
| `VITE_GOOGLE_CLIENT_ID` | Google 로그인 |
| `VITE_KAKAO_MAP_JS_KEY` | 카카오 SDK 도메인에 Vercel URL 등록 |
| `VITE_JUSO_SEARCH_KEY` | 주소 검색 (BFF가 서버에서 주입) |
| `VITE_DATA_GO_KR_SERVICE_KEY` | 건축물대장 등 |
| `VITE_VWORLD_API_KEY` | 공시지가 등 |
| `VITE_VWORLD_DOMAIN` | **배포 호스트** (예: `landnote.vercel.app`) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | BFF 전용(필요 시). **VITE_ 금지** |

`VITE_*` 변경 후에는 **Redeploy** 해야 빌드에 반영됩니다.  
`VITE_BFF_BASE_URL` 은 비워 두세요 (같은 도메인 `/api`).

### 8-C. 외부 서비스에 배포 URL 등록

배포 URL 예: `https://landnote-xxxx.vercel.app`

| 서비스 | 등록 |
|--------|------|
| Supabase Auth Site URL / Redirect | `https://….vercel.app` , `https://….vercel.app/**` |
| Google OAuth | JS origins + Supabase 콜백 |
| 카카오 JS 키 도메인 | 배포 호스트 |
| juso 팝업 returnUrl | `https://….vercel.app/juso-return.html` |
| vworld domain | `VITE_VWORLD_DOMAIN`과 동일 |

### 8-D. 동작 확인

1. 배포 URL 접속 → 로그인
2. 매물 등록에서 **주소 검색** (juso)
3. 건축물대장·공시지가 조회 (공공데이터 / vworld)
4. `/api/health` → `{ "ok": true, "service": "landnote-bff" }`

로컬에서 BFF만 따로: `npm run start` 또는 `npm run dev:all`.  
Render에 올리는 기존 방식(`npm start`)도 그대로 동작합니다.

---

## 8 (참고). Render 단일 서버 배포

1. [Render](https://render.com) → **New Web Service** → GitHub 연결
2. Build: `npm install && npm run build`
3. Start: `npm start`
4. Environment에 API 키 추가 (`.env.example` 참고)

---

## 문제 해결

| 증상 | 확인 |
|------|------|
| Google 로그인 후 돌아오지 않음 | Redirect URLs에 localhost URL 등록 |
| properties 비어 있음 | 로그인 계정과 RLS `user_id` 일치 여부 |
| CORS 오류 | Site URL 설정 |
| 로컬만 쓰고 싶음 | `VITE_AUTH_DEV_BYPASS=true` + Supabase URL 비움 |
| 비밀번호 재설정 메일이 안 옴 | 1) 스팸함 2) Custom SMTP 3) Auth rate limit 4) 계정이 존재하는지 |
| 재설정 링크가 localhost로 감 | Site URL·Redirect URLs를 배포 도메인으로 변경 |
