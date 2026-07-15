const BRAND = '#C8102E';

/**
 * 초대 가입 시 기존 회원에게 표시하는 소속 이관 확인 모달
 * @param {{ onCancel: () => void, onAccept: () => void, busy?: boolean }} props
 */
export function InviteExistingUserModal({ onCancel, onAccept, busy = false }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400, background: '#fff', borderRadius: 14, padding: '24px 22px',
        boxShadow: '0 20px 50px rgba(0,0,0,.35)',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
          소속 변경 안내
        </div>
        <div style={{ fontSize: 14, color: '#475569', lineHeight: 1.65, marginBottom: 20 }}>
          이미 가입된 계정입니다. 초대한 회사의 직원으로 소속을 변경하시겠습니까?
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            style={{ flex: 1, height: 42, borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 600 }}
          >
            취소
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onAccept}
            style={{ flex: 1, height: 42, borderRadius: 8, border: 'none', background: BRAND, color: '#fff', cursor: 'pointer', fontWeight: 700 }}
          >
            {busy ? '처리 중…' : '수락'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default InviteExistingUserModal;
