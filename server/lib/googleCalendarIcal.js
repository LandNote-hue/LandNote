export function isAllowedGoogleCalendarIcsUrl(urlStr) {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== 'https:') return false;
    if (url.hostname !== 'calendar.google.com') return false;
    if (!url.pathname.includes('/calendar/ical/')) return false;
    return true;
  } catch {
    return false;
  }
}

function mapFetchError(status) {
  if (status === 404) {
    return '캘린더를 찾을 수 없습니다. 공개 캘린더이거나 비공개 iCal 주소인지 확인해 주세요.';
  }
  if (status === 401 || status === 403) {
    return '캘린더에 접근할 수 없습니다. Google Calendar 설정의「iCal 형식의 비공개 주소」를 붙여 넣어 주세요.';
  }
  return `캘린더를 불러오지 못했습니다. (${status})`;
}

export async function fetchGoogleCalendarIcsText(urlStr) {
  if (!isAllowedGoogleCalendarIcsUrl(urlStr)) {
    const err = new Error('Google Calendar iCal 주소만 요청할 수 있습니다.');
    err.status = 400;
    throw err;
  }

  const res = await fetch(urlStr, {
    headers: { Accept: 'text/calendar, text/plain, */*' },
    redirect: 'follow',
  });

  if (!res.ok) {
    const err = new Error(mapFetchError(res.status));
    err.status = res.status >= 500 ? 502 : res.status;
    throw err;
  }

  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) {
    const err = new Error('유효한 ICS 캘린더 응답이 아닙니다.');
    err.status = 502;
    throw err;
  }

  return text;
}
