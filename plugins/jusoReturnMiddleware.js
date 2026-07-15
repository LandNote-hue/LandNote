/**
 * juso 팝업 API는 주소 선택 후 returnUrl로 POST 전송.
 * Vite/정적 서버는 POST를 처리하지 못해 404 → 이 미들웨어가 HTML+콜백 스크립트 반환.
 * @see https://business.juso.go.kr/addrlink/devAddrLinkRequestWrite.do?menu=menu2
 */

const JUSO_RETURN_PATH = '/juso-return.html';

function readFormBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      resolve(Object.fromEntries(new URLSearchParams(raw)));
    });
    req.on('error', reject);
  });
}

function esc(s) {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n');
}

function callbackHtml(fields) {
  const args = [
    fields.roadFullAddr, fields.roadAddrPart1, fields.addrDetail, fields.roadAddrPart2,
    fields.engAddr, fields.jibunAddr, fields.zipNo, fields.admCd, fields.rnMgtSn, fields.bdMgtSn,
    fields.detBdNmList, fields.bdNm, fields.bdKdcd, fields.siNm, fields.sggNm, fields.emdNm,
    fields.liNm, fields.rn, fields.udrtYn, fields.buldMnnm, fields.buldSlno,
    fields.mtYn, fields.lnbrMnnm, fields.lnbrSlno, fields.emdNo,
  ].map(esc);

  return `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>주소 반환</title></head>
<body>
<script>
(function(){
  var args=[${args.map(a => `'${a}'`).join(',')}];
  var fn=window.opener&&(window.opener.jusoCallBack||window.opener.popCallBack);
  if(fn){ try{ fn.apply(window.opener,args); }catch(e){ console.error(e); } }
  window.close();
  setTimeout(function(){ document.body.innerHTML='<p style="font-family:sans-serif;padding:24px">주소가 반영되었습니다. 이 창을 닫아주세요.</p>'; },300);
})();
</script>
</body></html>`;
}

export function jusoReturnMiddleware() {
  return {
    name: 'juso-return-post',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== JUSO_RETURN_PATH || req.method !== 'POST') {
          next();
          return;
        }
        try {
          const fields = await readFormBody(req);
          if (fields.inputYn !== 'Y') {
            res.statusCode = 400;
            res.end('Invalid juso return');
            return;
          }
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(callbackHtml(fields));
        } catch (err) {
          res.statusCode = 500;
          res.end('juso return handler error');
        }
      });
    },
  };
}
