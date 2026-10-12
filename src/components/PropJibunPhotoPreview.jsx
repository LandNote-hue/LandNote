import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { normalizePhotoSlots } from '../utils/readImageFile.js';

const DELAY_MS = 500;
const BOX = { width: '2.5cm', height: '2cm' };
const BOX_W_PX = 2.5 * 37.8;
const BOX_H_PX = 2 * 37.8;
const GAP = 10;

function firstPhotoSrc(property) {
  const slots = normalizePhotoSlots(property?.photos);
  return slots.find(Boolean) || null;
}

function posLeftOfCursor(clientX, clientY) {
  let left = clientX - BOX_W_PX - GAP;
  let top = clientY - BOX_H_PX / 2;
  if (left < 8) left = Math.min(clientX + GAP, window.innerWidth - BOX_W_PX - 8);
  if (top < 8) top = 8;
  if (top + BOX_H_PX > window.innerHeight - 8) top = Math.max(8, window.innerHeight - BOX_H_PX - 8);
  return { top, left };
}

/**
 * 지번주소에 커서를 0.5초 올리면, 커서 왼쪽에 등록 사진 미리보기.
 */
export function PropJibunPhotoPreview({ property, children }) {
  const src = firstPhotoSrc(property);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const timerRef = useRef(null);
  const pointerRef = useRef({ x: 0, y: 0 });

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => clearTimer(), []);

  const scheduleShow = () => {
    if (!src) return;
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setPos(posLeftOfCursor(pointerRef.current.x, pointerRef.current.y));
      setOpen(true);
    }, DELAY_MS);
  };

  const onEnter = (e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    scheduleShow();
  };

  const onMove = (e) => {
    pointerRef.current = { x: e.clientX, y: e.clientY };
    if (open) setPos(posLeftOfCursor(e.clientX, e.clientY));
  };

  const onLeave = () => {
    clearTimer();
    setOpen(false);
  };

  return (
    <>
      <div
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ display: 'inline-block', maxWidth: '100%' }}
      >
        {children}
      </div>
      {open && src && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: BOX.width,
            height: BOX.height,
            zIndex: 900,
            pointerEvents: 'none',
            borderRadius: 4,
            overflow: 'hidden',
            background: '#111',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)',
            border: '1px solid rgba(255,255,255,.35)',
          }}
        >
          <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>,
        document.body,
      )}
    </>
  );
}
