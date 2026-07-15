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
  var args=[${args.map((a) => `'${a}'`).join(',')}];
  var fn=window.opener&&(window.opener.jusoCallBack||window.opener.popCallBack);
  if(fn){ try{ fn.apply(window.opener,args); }catch(e){ console.error(e); } }
  window.close();
  setTimeout(function(){ document.body.innerHTML='<p style="font-family:sans-serif;padding:24px">주소가 반영되었습니다. 이 창을 닫아주세요.</p>'; },300);
})();
</script>
</body></html>`;
}

export function createJusoReturnHandler() {
  return (req, res) => {
    const fields = req.body;
    if (fields?.inputYn !== 'Y') {
      res.status(400).send('Invalid juso return');
      return;
    }
    res.type('html').send(callbackHtml(fields));
  };
}
