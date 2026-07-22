# LandNote Supabase 이메일 템플릿

Supabase Auth가 발송하는 **가입 확인(Confirm signup)** 메일에 LandNote 국문 HTML을 적용하는 방법입니다.

## 1. Supabase 대시보드 (코딩 없이 적용)

1. [Supabase Dashboard](https://supabase.com/dashboard) → 프로젝트 선택
2. **Authentication** → **Email Templates**
3. **Confirm signup** 탭 선택
4. **Subject (제목)** — `confirm-signup.subject.txt` 내용 붙여넣기:

   ```
   [LandNote] 이메일 인증을 완료해 주세요
   ```

5. **Body**에 `confirm-signup.html` 파일 **전체 내용**을 붙여넣기
6. **Save**

### Supabase 표준 변수

| 변수 | 설명 |
|------|------|
| `{{ .ConfirmationURL }}` | 사용자가 클릭하는 **인증 완료 URL** (필수) |
| `{{ .Email }}` | 가입한 이메일 주소 |
| `{{ .SiteURL }}` | 프로젝트 Site URL |

> 링크는 반드시 `{{ .ConfirmationURL }}` 을 사용하세요. `{{ConfirmationURL}}` (Go template 공백 포함) 형식입니다.

## 2. 발신인(From) 설정

**Authentication** → **SMTP Settings** (또는 Project Settings → Auth)

| 항목 | 권장 값 |
|------|---------|
| **Sender name** | `LandNote` |
| **Sender email** | `noreply@your-domain.com` (발신 전용) |

- Supabase **기본 메일**은 발신 주소 커스터마이즈가 제한될 수 있습니다.
- 운영 환경에서는 **Custom SMTP**(Resend, SendGrid, AWS SES, Gmail SMTP 등) 연결을 권장합니다.

## 3. Redirect URL (인증 후 이동)

**Authentication** → **URL Configuration**

| 항목 | 개발 | 배포 |
|------|------|------|
| Site URL | `http://localhost:5175` | `https://your-domain.com` |
| Redirect URLs | `http://localhost:5175/**` | `https://your-domain.com/**` |

프론트엔드 `signUpWithEmail` 은 인증 후 **`/login`** 으로 리다이렉트합니다 (`emailRedirectTo`).

Redirect URLs에 `/login` 이 포함되도록 `/**` 와일드카드를 등록해 두세요.

## 4. Confirm email 켜기

**Authentication** → **Providers** → **Email**

- **Confirm email**: ON (운영 필수)
- 개발 중 빠른 테스트: OFF 가능 (즉시 로그인)

## 5. 동작 확인

1. `/signup` 에서 이메일 가입
2. 메일함에서 `[LandNote] 이메일 인증…` 수신 확인
3. **이메일 인증하기** 클릭 → `/login` (또는 자동 로그인 후 대시보드)
4. 로그인·매물 동기화 정상 여부 확인

## 6. Nodemailer 등 자체 발송 (참고)

Supabase Auth 메일을 **직접 대체**하려면 GoTrue Hook / Edge Function이 필요합니다.  
일반적으로는 **Supabase Email Templates + Custom SMTP** 조합이 가장 단순합니다.

---

## Cursor 연동용 프롬프트 (보관)

```
유저가 이메일로 가입할 때 발송할 국문 이메일 인증(컨펌) 메일 템플릿과 발송 로직을 연동해줘.

- 템플릿: supabase/email-templates/confirm-signup.html 구조 적용
- 링크: {{ .ConfirmationURL }} (Supabase) 또는 emailRedirectTo와 Redirect URLs 일치
- 발신인: "LandNote" / noreply@...
- SETUP.md 및 supabase/email-templates/README.md 갱신
```
