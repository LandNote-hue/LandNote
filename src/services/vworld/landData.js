import { vworldGet, vworldExtractFields } from './vworldClient.js';

export const VWORLD_LAND = {
  CHARACTERISTICS: '/ned/data/getLandCharacteristics',
  INDVD_PRICE: '/ned/data/getIndvdLandPriceAttr',
  LAND_USE: '/ned/data/getLandUseAttr',
};

const YEAR_FALLBACK_DEPTH = 6;
/** 응답이 아예 없을 때만 끊는 안전 상한. 정상 응답은 이 시간까지 기다리지 않는다. */
const YEAR_REQUEST_TIMEOUT_MS = 8_000;
/** 더 최근 연도가 멈추면, 이미 도착한 이전 연도를 쓰기까지 기다리는 시간 */
const NEWER_YEAR_GRACE_MS = 450;

function isAbortError(err) {
  return err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError';
}

/**
 * 최근 연도 2개를 동시에 조회한다.
 * 최근 연도에 데이터가 있으면 그것을 쓰고, 멈추면 짧은 유예 후 이전 연도를 쓴 뒤 남은 요청은 취소한다.
 * @param {string[]} years 최신 연도가 앞
 */
async function raceYears(path, rootKey, pnu, years, extraParams) {
  const controllers = years.map(() => new AbortController());
  let settled = false;
  const stopAll = () => {
    for (const controller of controllers) controller.abort();
  };

  /** @type {Array<{ result?: { raw: unknown, item: unknown, fields: unknown[], stdrYear: string }, error?: unknown } | null>} */
  const outcomes = years.map(() => null);
  let open = years.length;

  return new Promise((resolve) => {
    /** @type {ReturnType<typeof setTimeout> | null} */
    let grace = null;

    const finish = (payload) => {
      if (settled) return;
      settled = true;
      if (grace) clearTimeout(grace);
      stopAll();
      resolve(payload);
    };

    const onUpdate = () => {
      if (settled) return;
      for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        if (!outcome) break;
        if (outcome.result?.fields.length) {
          finish({ kind: 'data', result: outcome.result });
          return;
        }
      }

      const olderHit = outcomes.find((outcome) => outcome?.result?.fields.length);
      const newerPending = outcomes.some((outcome, index) => (
        !outcome && outcomes.slice(index + 1).some((later) => later?.result?.fields.length)
      ));
      if (olderHit && newerPending && !grace) {
        grace = setTimeout(() => {
          grace = null;
          if (settled) return;
          const hit = outcomes.find((outcome) => outcome?.result?.fields.length);
          if (hit?.result) finish({ kind: 'data', result: hit.result });
        }, NEWER_YEAR_GRACE_MS);
      }

      if (open > 0) return;

      const empty = outcomes.find((outcome) => outcome?.result);
      if (empty?.result) {
        finish({ kind: 'empty', result: empty.result });
        return;
      }
      const failed = [...outcomes].reverse().find((outcome) => outcome?.error);
      finish({ kind: 'error', error: failed?.error });
    };

    years.forEach((year, index) => {
      vworldGet(
        path,
        { pnu, stdrYear: year, ...extraParams },
        { timeout: YEAR_REQUEST_TIMEOUT_MS, signal: controllers[index].signal },
      ).then((raw) => {
        const fields = vworldExtractFields(raw, rootKey);
        outcomes[index] = {
          result: { raw, item: fields[0] ?? null, fields, stdrYear: year },
        };
      }).catch((err) => {
        outcomes[index] = { error: err };
        if (!isAbortError(err)) {
          console.warn(`[vworld] ${rootKey} ${year} 조회 실패:`, err?.message || err);
        }
      }).finally(() => {
        open -= 1;
        onUpdate();
      });
    });
  });
}

async function fetchWithYearFallback(path, rootKey, pnu, startYear, extraParams = {}) {
  const baseYear = parseInt(startYear, 10) || new Date().getFullYear();
  /** @type {{ raw: unknown, item: unknown, fields: unknown[], stdrYear: string } | null} */
  let newestEmpty = null;
  let lastErr;

  for (let offset = 0; offset < YEAR_FALLBACK_DEPTH; offset += 2) {
    const years = [];
    for (let step = 0; step < 2 && offset + step < YEAR_FALLBACK_DEPTH; step++) {
      years.push(String(baseYear - offset - step));
    }
    const raced = await raceYears(path, rootKey, pnu, years, extraParams);
    if (raced.kind === 'data') return raced.result;
    if (raced.kind === 'empty' && !newestEmpty) newestEmpty = raced.result;
    if (raced.kind === 'error') lastErr = raced.error;
  }

  if (newestEmpty) return newestEmpty;
  throw lastErr ?? new Error('vworld 조회 실패');
}

/**
 * @param {string} pnu 19자리
 * @param {string} stdrYear 기준연도
 */
export async function fetchLandCharacteristics(pnu, stdrYear) {
  return fetchWithYearFallback(VWORLD_LAND.CHARACTERISTICS, 'landCharacteristics', pnu, stdrYear);
}

/** 개별공시지가속성조회 */
export async function fetchIndvdLandPrice(pnu, stdrYear) {
  return fetchWithYearFallback(VWORLD_LAND.INDVD_PRICE, 'indvdLandPrices', pnu, stdrYear);
}

/** 토지이용계획속성조회 — 다건 */
export async function fetchLandUsePlan(pnu, stdrYear) {
  return fetchWithYearFallback(
    VWORLD_LAND.LAND_USE,
    'landUses',
    pnu,
    stdrYear,
    { numOfRows: 100 },
  );
}

/**
 * 토지 특성·공시지가·이용계획 병렬 조회
 * @param {string} pnu
 * @param {string} [stdrYear] 미지정 시 올해
 */
export async function fetchVworldLandBundle(pnu, stdrYear) {
  const year = stdrYear || String(new Date().getFullYear());

  const [price, characteristics, landUse] = await Promise.all([
    fetchIndvdLandPrice(pnu, year),
    fetchLandCharacteristics(pnu, year),
    fetchLandUsePlan(pnu, year),
  ]);
  const settledYear = price.fields?.length
    ? price.stdrYear
    : (characteristics.stdrYear || year);

  return { pnu, stdrYear: settledYear, characteristics, price, landUse };
}
