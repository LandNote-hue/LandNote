import { fetchGoogleCalendarIcsText } from '../server/lib/googleCalendarIcal.js';
import { GOOGLE_CALENDAR_ICAL_PATH } from '../server/routes/googleCalendarIcal.js';

export function googleCalendarIcalProxyPlugin() {
  return {
    name: 'google-calendar-ical-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== GOOGLE_CALENDAR_ICAL_PATH || req.method !== 'GET') {
          next();
          return;
        }

        try {
          const incoming = new URL(req.url, 'http://localhost');
          const targetUrl = incoming.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ message: 'url 파라미터가 필요합니다.' }));
            return;
          }

          const text = await fetchGoogleCalendarIcsText(targetUrl);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
          res.end(text);
        } catch (err) {
          console.error('[google-calendar-ical-proxy]', err);
          res.statusCode = err.status || 502;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ message: err.message || '캘린더 불러오기 실패' }));
        }
      });
    },
  };
}
