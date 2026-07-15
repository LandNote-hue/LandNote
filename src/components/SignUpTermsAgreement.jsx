import { useState } from 'react';
import { TERMS_DATA, isAllTermsAgreed } from '../data/termsData.js';

const BRAND = '#C8102E';

/**
 * @param {{
 *   agreements: Record<string, boolean>,
 *   onChange: (next: Record<string, boolean>) => void,
 * }} props
 */
export function SignUpTermsAgreement({ agreements, onChange }) {
  const [expandedId, setExpandedId] = useState(null);
  const allChecked = isAllTermsAgreed(agreements);

  const setItem = (id, checked) => {
    onChange({ ...agreements, [id]: checked });
  };

  const toggleAll = (checked) => {
    onChange(Object.fromEntries(TERMS_DATA.items.map((item) => [item.id, checked])));
  };

  return (
    <div style={{
      marginBottom: 16, padding: '14px 14px 12px',
      background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
      borderRadius: 10,
    }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <TermCheckbox checked={allChecked} onChange={toggleAll} />
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>전체 동의하기</span>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TERMS_DATA.items.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <div key={item.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <TermCheckbox
                  checked={Boolean(agreements[item.id])}
                  onChange={(checked) => setItem(item.id, checked)}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,.88)', lineHeight: 1.45 }}>
                      <span style={{
                        display: 'inline-block', minWidth: 34, fontSize: 11, fontWeight: 700,
                        color: item.required ? '#FCA5A5' : 'rgba(255,255,255,.45)', marginRight: 4,
                      }}>
                        [{item.required ? '필수' : '선택'}]
                      </span>
                      {item.title} 동의
                    </span>
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      style={moreBtnStyle}
                    >
                      {expanded ? '접기' : '더보기'}
                    </button>
                  </div>
                  {expanded && (
                    <div style={{
                      marginTop: 8, padding: '10px 12px',
                      background: 'rgba(0,0,0,.22)', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,.08)',
                      fontSize: 11, color: 'rgba(255,255,255,.62)', lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {item.content}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TermCheckbox({ checked, onChange }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
        border: `1.5px solid ${checked ? BRAND : 'rgba(255,255,255,.25)'}`,
        background: checked ? BRAND : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', padding: 0,
      }}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  );
}

const moreBtnStyle = {
  background: 'none', border: 'none', padding: 0, flexShrink: 0,
  color: 'rgba(255,255,255,.45)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
  textDecoration: 'underline',
};
