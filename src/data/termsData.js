/**
 * 약관 문구는 이 파일만 수정하면 회원가입 UI에 반영됩니다.
 * version을 올리면 신규 가입 시 새 버전이 기록됩니다.
 */
export const TERMS_VERSION = 'v1.0';

export const TERMS_DATA = {
  version: TERMS_VERSION,
  items: [
    {
      id: 'service',
      required: true,
      title: '서비스 이용약관',
      content: `제1조 (목적)
본 약관은 LandNote(이하 "서비스")의 이용과 관련하여 회사와 이용자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.

제2조 (서비스의 제공)
① 회사는 부동산 매물 관리 등 서비스 설명에 따른 기능을 제공합니다.
② 서비스의 구체적 내용은 운영 정책에 따라 변경될 수 있습니다.

(본문은 추후 법무 검토 후 교체 예정입니다.)`,
    },
    {
      id: 'privacy',
      required: true,
      title: '개인정보 수집 및 이용',
      content: `1. 수집 항목
- 필수: 이메일, 비밀번호(암호화 저장), 서비스 이용 기록
- 선택: 프로필 정보, 연락처 등 이용자가 입력한 정보

2. 이용 목적
- 회원 식별, 서비스 제공, 고객 지원, 보안 및 부정 이용 방지

3. 보유 기간
- 회원 탈퇴 시까지 (관련 법령에 따른 보존 기간 예외 적용)

(본문은 추후 법무 검토 후 교체 예정입니다.)`,
    },
    {
      id: 'marketing',
      required: false,
      title: '마케팅 정보 수신',
      content: `LandNote의 새 기능, 이벤트, 프로모션 등 마케팅 정보를 이메일로 받아보실 수 있습니다.

본 동의는 선택 사항이며, 동의하지 않아도 서비스 이용에 제한이 없습니다. 동의 후에도 설정에서 수신을 거부할 수 있습니다.

(본문은 추후 교체 예정입니다.)`,
    },
  ],
};

const REQUIRED_IDS = TERMS_DATA.items.filter((item) => item.required).map((item) => item.id);

/** @param {Record<string, boolean>} agreements */
export function validateRequiredTerms(agreements) {
  const allRequired = REQUIRED_IDS.every((id) => agreements[id]);
  if (!allRequired) return '필수 약관에 동의해주세요.';
  return null;
}

/** @param {Record<string, boolean>} agreements */
export function buildSignUpConsentPayload(agreements) {
  const termsRequiredAgreed = REQUIRED_IDS.every((id) => Boolean(agreements[id]));
  return {
    terms_version: TERMS_DATA.version,
    terms_required_agreed: termsRequiredAgreed,
    marketing_agreed: Boolean(agreements.marketing),
    terms_agreed_at: new Date().toISOString(),
    terms_items: TERMS_DATA.items.map((item) => ({
      id: item.id,
      required: item.required,
      agreed: Boolean(agreements[item.id]),
    })),
  };
}

export function createEmptyTermAgreements() {
  return Object.fromEntries(TERMS_DATA.items.map((item) => [item.id, false]));
}

export function isAllTermsAgreed(agreements) {
  return TERMS_DATA.items.every((item) => agreements[item.id]);
}
