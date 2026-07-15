import { fetchGoogleCalendarIcsText } from '../lib/googleCalendarIcal.js';

export const GOOGLE_CALENDAR_ICAL_PATH = '/api/google-calendar/ical';

export function createGoogleCalendarIcalHandler() {
  return async (req, res) => {
    const url = req.query.url;
    if (!url || typeof url !== 'string') {
      res.status(400).json({ message: 'url 파라미터가 필요합니다.' });
      return;
    }

    try {
      const text = await fetchGoogleCalendarIcsText(url);
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.send(text);
    } catch (err) {
      const status = err.status || 502;
      res.status(status).json({ message: err.message || '캘린더 불러오기 실패' });
    }
  };
}
