import { isSupabaseConfigured, supabase } from '../../lib/supabase.js';
import { getSyncCompanyId, getSyncUserId } from './syncContext.js';
import { compressDataUrl } from '../../utils/readImageFile.js';

export const PROPERTY_PHOTOS_BUCKET = 'property-photos';

/** @param {unknown} value */
export function isRemotePhotoUrl(value) {
  return typeof value === 'string'
    && (value.startsWith('http://') || value.startsWith('https://'));
}

/** @param {unknown} value */
export function isDataUrlPhoto(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

/**
 * data URL → Blob
 * @param {string} dataUrl
 * @returns {{ blob: Blob, ext: string, contentType: string }}
 */
export function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid image data URL');
  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const ext = contentType.includes('png') ? 'png'
    : contentType.includes('webp') ? 'webp'
      : contentType.includes('gif') ? 'gif'
        : 'jpg';
  return { blob: new Blob([bytes], { type: contentType }), ext, contentType };
}

/**
 * @param {Record<string, unknown>} prop
 * @returns {string}
 */
function storagePropKey(prop) {
  return String(prop.cloudId || prop.cloudLocalId || prop.id || '');
}

/**
 * @param {Record<string, unknown>} prop
 * @param {number} index
 * @param {string} ext
 */
export function buildPropertyPhotoPath(prop, index, ext = 'jpg') {
  const companyId = prop.companyId || getSyncCompanyId() || 'solo';
  const ownerId = prop.ownerId || getSyncUserId() || 'unknown';
  const propKey = storagePropKey(prop);
  if (!propKey) throw new Error('property key missing for photo path');
  return `${companyId}/${ownerId}/${propKey}/${index}.${ext}`;
}

/**
 * @param {{ dataUrl: string, prop: Record<string, unknown>, index: number }} args
 * @returns {Promise<string>} public URL
 */
export async function uploadPropertyPhotoDataUrl({ dataUrl, prop, index }) {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const optimized = await compressDataUrl(dataUrl);
  const { blob, ext, contentType } = dataUrlToBlob(optimized);
  const path = buildPropertyPhotoPath(prop, index, ext);
  const { error } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .upload(path, blob, {
      upsert: true,
      contentType,
      cacheControl: '3600',
    });
  if (error) throw error;
  const { data } = supabase.storage.from(PROPERTY_PHOTOS_BUCKET).getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error('public URL missing');
  // cache-bust so replacing the same path refreshes in <img>
  return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
}

/** @param {unknown} photos @returns {string[]} */
export function normalizePhotoList(photos) {
  if (!Array.isArray(photos)) return [];
  return photos.filter((p) => typeof p === 'string' && p.length > 0);
}

/** @param {Blob} blob @returns {Promise<string>} */
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('사진 변환에 실패했습니다.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 매물 복사 시 사진 독립 복제
 * - data URL: 그대로 복제
 * - 원격 URL: fetch 후 data URL로 변환 → 이후 Storage에 새 경로로 업로드됨
 * @param {unknown} photos
 * @returns {Promise<string[]>}
 */
export async function clonePhotosForDuplicate(photos) {
  const list = normalizePhotoList(photos);
  if (!list.length) return [];

  /** @type {string[]} */
  const out = [];
  for (const photo of list) {
    if (isDataUrlPhoto(photo)) {
      out.push(await compressDataUrl(photo));
      continue;
    }
    if (!isRemotePhotoUrl(photo)) continue;
    try {
      const res = await fetch(photo);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      if (!blob.type.startsWith('image/') && !blob.size) throw new Error('empty image');
      const rawDataUrl = await blobToDataUrl(blob);
      const dataUrl = await compressDataUrl(rawDataUrl);
      if (!isDataUrlPhoto(dataUrl)) throw new Error('invalid data URL');
      out.push(dataUrl);
    } catch (err) {
      console.error('[propertyPhotoStorage] clone remote photo failed', err);
      // 원본 URL 유지 — 표시는 가능, Storage 분리는 다음 동기화/재저장에서
      out.push(photo);
    }
  }
  return out;
}

/**
 * 로컬 data URL 사진을 Storage에 올리고 http(s) URL로 교체
 * @param {Record<string, unknown>} prop
 * @returns {Promise<Record<string, unknown>>}
 */
export async function ensurePropertyPhotosInCloud(prop) {
  const photos = Array.isArray(prop.photos) ? prop.photos.filter(Boolean) : [];
  if (!photos.length) return prop;
  if (!photos.some(isDataUrlPhoto)) return prop;
  if (!isSupabaseConfigured || !supabase) return prop;
  if (!storagePropKey(prop)) return prop;

  const next = [];
  let changed = false;
  for (let i = 0; i < photos.length; i += 1) {
    const photo = photos[i];
    if (!isDataUrlPhoto(photo)) {
      next.push(photo);
      continue;
    }
    try {
      const url = await uploadPropertyPhotoDataUrl({ dataUrl: photo, prop, index: i });
      next.push(url);
      changed = true;
    } catch (err) {
      console.error('[propertyPhotoStorage] upload failed', prop.id, i, err);
      next.push(photo);
    }
  }
  return changed ? { ...prop, photos: next } : prop;
}

/**
 * @param {Record<string, unknown>} prop
 */
export async function removePropertyPhotosFromStorage(prop) {
  if (!isSupabaseConfigured || !supabase) return;
  const companyId = prop.companyId || getSyncCompanyId() || 'solo';
  const ownerId = prop.ownerId || getSyncUserId();
  const propKey = storagePropKey(prop);
  if (!ownerId || !propKey) return;
  const prefix = `${companyId}/${ownerId}/${propKey}`;
  try {
    const { data: files, error: listErr } = await supabase.storage
      .from(PROPERTY_PHOTOS_BUCKET)
      .list(prefix);
    if (listErr || !files?.length) return;
    const paths = files.map((f) => `${prefix}/${f.name}`);
    await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove(paths);
  } catch (err) {
    console.error('[propertyPhotoStorage] remove failed', prop.id, err);
  }
}
