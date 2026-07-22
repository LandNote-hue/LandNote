import React, { useRef } from 'react';
import { readImageAsDataUrl, normalizePhotoSlots } from '../utils/readImageFile.js';

const C = {
  brand: '#C8102E',
  brandL: '#FBE9EC',
  surf2: '#F8F9FB',
  bdr: '#E8EAED',
  txM: '#6B7280',
  txP: '#94A3B8',
};

const SLOT_LABELS = ['대표사진', '추가사진', '추가사진'];

const addIcon = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
    <line x1="16" y1="5" x2="22" y2="5" />
    <line x1="19" y1="2" x2="19" y2="8" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

/**
 * @param {{ slots: (string|null)[], onChange: (slots: (string|null)[]) => void, compact?: boolean }} props
 */
export function PropertyPhotoPicker({ slots, onChange, compact = false }) {
  const inputRef = useRef(null);
  const pickIndexRef = useRef(0);
  const normalized = normalizePhotoSlots(slots);

  const openPicker = (index) => {
    pickIndexRef.current = index;
    inputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const next = [...normalized];
      next[pickIndexRef.current] = dataUrl;
      onChange(next);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '파일을 불러오지 못했습니다.');
    }
  };

  const removeAt = (index, e) => {
    e.stopPropagation();
    const next = [...normalized];
    next[index] = null;
    onChange(next);
  };

  return (
    <div style={{ padding: compact ? '14px 20px' : '16px 20px', borderBottom: `1px solid ${C.bdr}` }}>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: compact ? 12 : 16 }}>
        {normalized.map((url, i) => (
          <div
            key={i}
            role="button"
            tabIndex={0}
            onClick={() => openPicker(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPicker(i); }}
            style={{
              aspectRatio: '16/9',
              border: `2px dashed ${url ? C.bdr : C.bdr}`,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: compact ? 6 : 8,
              cursor: 'pointer',
              background: url ? '#000' : C.surf2,
              transition: 'all .15s',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              if (!url) {
                e.currentTarget.style.borderColor = C.brand;
                e.currentTarget.style.background = C.brandL;
              }
            }}
            onMouseLeave={(e) => {
              if (!url) {
                e.currentTarget.style.borderColor = C.bdr;
                e.currentTarget.style.background = C.surf2;
              }
            }}
          >
            {url ? (
              <>
                <img
                  src={url}
                  alt={SLOT_LABELS[i]}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
                <button
                  type="button"
                  title="사진 삭제"
                  onClick={(e) => removeAt(i, e)}
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(0,0,0,.55)',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '4px 8px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,.55))',
                    fontSize: 11,
                    color: '#fff',
                    textAlign: 'center',
                  }}
                >
                  클릭하여 변경
                </div>
              </>
            ) : (
              <>
                <span style={{ display: 'inline-flex', color: C.txP }} aria-hidden>{addIcon}</span>
                <span style={{ fontSize: 12, color: C.txM }}>{SLOT_LABELS[i]}</span>
                <span style={{ fontSize: 12, color: C.txP }}>클릭해서 불러오기</span>
                <span style={{ fontSize: 11, color: C.txP }}>5MB 이하 · 저장 시 1280px 최적화</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
