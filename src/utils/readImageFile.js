const MAX_BYTES = 5 * 1024 * 1024;

/**
 * @param {File} file
 * @returns {Promise<string>} data URL
 */
export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('이미지 파일만 등록할 수 있습니다.'));
      return;
    }
    if (file.size > MAX_BYTES) {
      reject(new Error('사진은 장당 5MB 이하만 등록할 수 있습니다.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('파일을 불러오지 못했습니다.'));
    reader.readAsDataURL(file);
  });
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
