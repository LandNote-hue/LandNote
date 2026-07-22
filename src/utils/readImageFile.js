/** 업로드 원본 상한 — 이 크기 초과 파일은 등록 거부 */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * 매물 사진 저장 프리셋 (경량)
 * — 긴 변 1280px, JPEG 82% · 장당 약 150~400KB
 */
export const PROPERTY_PHOTO_COMPRESS = {
  maxEdge: 1280,
  quality: 0.82,
  mime: 'image/jpeg',
};

/** @param {Blob} blob @returns {Promise<string>} */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('사진 변환에 실패했습니다.'));
    reader.readAsDataURL(blob);
  });
}

/** @param {string} dataUrl @returns {Promise<HTMLImageElement>} */
function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = dataUrl;
  });
}

/** @param {File} file @returns {Promise<HTMLImageElement|ImageBitmap>} */
async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {HTMLImageElement|ImageBitmap} source
 * @param {{ maxEdge?: number, quality?: number, mime?: string }} [options]
 * @returns {Promise<string>} data URL (JPEG)
 */
async function compressImageSource(source, options = {}) {
  const { maxEdge, quality, mime } = { ...PROPERTY_PHOTO_COMPRESS, ...options };
  const srcW = source.width;
  const srcH = source.height;
  if (!srcW || !srcH) throw new Error('이미지 크기를 읽지 못했습니다.');

  const scale = Math.min(1, maxEdge / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지 처리를 지원하지 않는 환경입니다.');
  ctx.drawImage(source, 0, 0, w, h);

  if (typeof source.close === 'function') source.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('사진 압축에 실패했습니다.'))),
      mime,
      quality,
    );
  });
  return blobToDataUrl(blob);
}

/**
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number, mime?: string }} [options]
 * @returns {Promise<string>} compressed data URL
 */
export async function compressImageFile(file, options = {}) {
  const source = await loadImageSource(file);
  return compressImageSource(source, options);
}

/**
 * @param {string} dataUrl
 * @param {{ maxEdge?: number, quality?: number, mime?: string }} [options]
 * @returns {Promise<string>}
 */
export async function compressDataUrl(dataUrl, options = {}) {
  if (!dataUrl || !String(dataUrl).startsWith('data:image/')) return dataUrl;
  const img = await loadImageFromDataUrl(dataUrl);
  return compressImageSource(img, options);
}

/**
 * @param {File} file
 * @returns {Promise<string>} 5MB 이하 원본만 허용 → 경량 프리셋으로 압축한 data URL
 */
export async function readImageAsDataUrl(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 등록할 수 있습니다.');
  }
  if (file.size > MAX_BYTES) {
    throw new Error('사진은 장당 5MB 이하만 등록할 수 있습니다.');
  }
  return compressImageFile(file);
}

/** @param {unknown} photos @returns {(string|null)[]} */
export function normalizePhotoSlots(photos) {
  const src = Array.isArray(photos) ? photos : [];
  return [0, 1, 2].map((i) => (typeof src[i] === 'string' && src[i] ? src[i] : null));
}

/** @param {(string|null)[]} slots @returns {string[]} */
export function photoSlotsToSave(slots) {
  return slots.filter((s) => typeof s === 'string' && s.length > 0);
}
