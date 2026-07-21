import { emptyPriceForm } from '../utils/propertyForm.js';
import { emptyBuildingForm, emptyLandForm, emptyLocationForm } from '../services/publicData/mapToPropertyForm.js';
import { initialAddressKeys } from '../hooks/usePropertyAddressLookup.js';

const STORAGE_KEY = 'landnote.propertyRegisterDraft';

const DEFAULT_DETAIL = () => ({
  title: '',
  agentName: '',
  agentTel: '',
  promo: '',
  memo: '',
});

/** @param {string} [userId] */
export function loadPropertyRegisterDraft(userId) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (userId && parsed.userId && parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** @param {Record<string, unknown>} draft @param {string} [userId] */
export function savePropertyRegisterDraft(draft, userId) {
  const payload = {
    ...draft,
    userId: userId || draft.userId || null,
    savedAt: new Date().toISOString(),
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    try {
      const { photoSlots, ...withoutPhotos } = payload;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...withoutPhotos, photoSlots: [null, null, null] }));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearPropertyRegisterDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** @param {Record<string, unknown>|null|undefined} raw */
export function hydratePropertyRegisterDraft(raw) {
  if (!raw) return null;
  return {
    trade: typeof raw.trade === 'string' ? raw.trade : 'SALE',
    mainType: typeof raw.mainType === 'string' ? raw.mainType : 'COMMERCIAL',
    subType: typeof raw.subType === 'string' ? raw.subType : 'WHOLE_BUILDING',
    status: typeof raw.status === 'string' ? raw.status : 'NEW',
    pub: typeof raw.pub === 'string' ? raw.pub : 'true',
    priceForm: { ...emptyPriceForm(), ...(raw.priceForm && typeof raw.priceForm === 'object' ? raw.priceForm : {}) },
    roadSearch: typeof raw.roadSearch === 'string' ? raw.roadSearch : '',
    detailForm: { ...DEFAULT_DETAIL(), ...(raw.detailForm && typeof raw.detailForm === 'object' ? raw.detailForm : {}) },
    photoSlots: Array.isArray(raw.photoSlots)
      ? [0, 1, 2].map((i) => (typeof raw.photoSlots[i] === 'string' ? raw.photoSlots[i] : null))
      : [null, null, null],
    locationForm: { ...emptyLocationForm(), ...(raw.locationForm && typeof raw.locationForm === 'object' ? raw.locationForm : {}) },
    landForm: { ...emptyLandForm(), ...(raw.landForm && typeof raw.landForm === 'object' ? raw.landForm : {}) },
    buildingForm: { ...emptyBuildingForm(), ...(raw.buildingForm && typeof raw.buildingForm === 'object' ? raw.buildingForm : {}) },
    addressKeys: { ...initialAddressKeys(), ...(raw.addressKeys && typeof raw.addressKeys === 'object' ? raw.addressKeys : {}) },
    lookup: raw.lookup && typeof raw.lookup === 'object' ? raw.lookup : null,
  };
}
