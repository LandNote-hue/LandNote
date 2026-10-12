import { formatKoreanAmountFromMan } from './formatMoney.js';
import { extraParcelCount, formatJibunWithExtraParcels } from './propertyParcels.js';
import { propJibunAddr, propDisplayAddr } from './propAddress.js';

/** Windows 파일명에 쓸 수 없는 문자 제거 */
function safeFilePart(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * PDF 저장 기본 파일명 (확장자 제외). 브라우저가 .pdf를 붙인다.
 * @param {Record<string, unknown>|null|undefined} prop
 */
export function brochurePdfFileName(prop) {
  const amount = safeFilePart(formatKoreanAmountFromMan(prop?.price) || '');
  const jibun = safeFilePart(
    formatJibunWithExtraParcels(
      propJibunAddr(prop) || propDisplayAddr(prop),
      extraParcelCount(prop),
    ) || propDisplayAddr(prop) || '',
  );
  if (amount && jibun) return `${amount}_${jibun}`;
  return jibun || amount || '매각안내서';
}

/**
 * PDF뷰 안내서를 별도 창에 복제해 인쇄한다.
 * 앱 Win(position:fixed, overflow:hidden)과 0×0 iframe은 브라우저가 빈 페이지로 인쇄한다.
 * @param {Element|null|undefined} rootEl
 * @param {{ fileName?: string }} [opts]
 */
export function printPdfBrochure(rootEl, opts = {}) {
  if (!rootEl || typeof document === 'undefined') return;

  const fileName = safeFilePart(opts.fileName) || '매각안내서';
  const clone = cloneForPrint(rootEl);
  const cssText = collectStylesheetHtml();
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeAttr(fileName)}</title>
${cssText}
<style>
  @page { size: A4 landscape; margin: 5mm; }
  html, body, * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    height: auto !important;
    overflow: visible !important;
    color: #1a202c;
  }
  .prop-pdf-print-only { display: block !important; }
  .no-print { display: none !important; }
  .prop-pdf-sale-badge {
    border: 1.5px solid #1B3A5F !important;
    color: #1B3A5F !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .prop-pdf-ink-bar {
    display: block !important;
    height: 3px !important;
    background: #1B3A5F !important;
    box-shadow: inset 0 0 0 100vmax #1B3A5F !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .prop-pdf-print-root,
  .prop-pdf-print-scroll,
  .prop-pdf-print-pane {
    display: block !important;
    height: auto !important;
    min-height: 0 !important;
    overflow: visible !important;
    position: static !important;
    flex: none !important;
  }
  .prop-pdf-print-root {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
  .prop-pdf-detail-panel {
    height: 236px !important;
    max-height: 236px !important;
    overflow: hidden !important;
    page-break-inside: avoid !important;
  }
  .prop-pdf-asset-table {
    height: 100% !important;
  }
</style>
</head>
<body></body>
</html>`;

  const popup = window.open('', '_blank', 'width=1400,height=900');
  if (popup) {
    writeAndPrint(popup, html, clone, fileName);
    return;
  }

  printViaSizedIframe(html, clone, fileName);
}

/** @param {Element} rootEl */
function cloneForPrint(rootEl) {
  const clone = rootEl.cloneNode(true);
  bakePrintColors(rootEl, clone);
  const srcCanvases = rootEl.querySelectorAll('canvas');
  const destCanvases = clone.querySelectorAll('canvas');
  srcCanvases.forEach((src, i) => {
    const dest = destCanvases[i];
    if (!dest) return;
    try {
      const img = document.createElement('img');
      img.src = src.toDataURL('image/png');
      img.alt = '';
      img.style.cssText = dest.getAttribute('style') || 'max-width:100%;height:auto;display:block;';
      dest.replaceWith(img);
    } catch {
      /* tainted canvas */
    }
  });
  if (clone instanceof HTMLElement) {
    clone.style.height = 'auto';
    clone.style.minHeight = '0';
    clone.style.overflow = 'visible';
    clone.style.position = 'static';
  }
  return clone;
}

/**
 * 브라우저는 인쇄 시 배경색을 빼는 경우가 많다.
 * 계산된 색을 인라인으로 고정하고, 짙은 배경은 inset shadow로 한 번 더 남긴다.
 * @param {Element} srcRoot
 * @param {Node} destRoot
 */
function bakePrintColors(srcRoot, destRoot) {
  if (!(destRoot instanceof Element)) return;
  const srcEls = [srcRoot, ...srcRoot.querySelectorAll('*')];
  const destEls = [destRoot, ...destRoot.querySelectorAll('*')];
  const n = Math.min(srcEls.length, destEls.length);
  for (let i = 0; i < n; i += 1) {
    const src = srcEls[i];
    const dest = destEls[i];
    if (!(dest instanceof HTMLElement)) continue;
    const cs = getComputedStyle(src);
    dest.style.setProperty('-webkit-print-color-adjust', 'exact', 'important');
    dest.style.setProperty('print-color-adjust', 'exact', 'important');
    dest.style.setProperty('color-adjust', 'exact', 'important');
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      dest.style.setProperty('background-color', bg, 'important');
      if (isDarkColor(bg)) {
        const prev = dest.style.boxShadow;
        const fill = `inset 0 0 0 100vmax ${bg}`;
        dest.style.setProperty('box-shadow', prev ? `${fill}, ${prev}` : fill, 'important');
      }
    }
    if (cs.color) dest.style.setProperty('color', cs.color, 'important');
    const borderColor = cs.borderColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
      dest.style.setProperty('border-color', borderColor, 'important');
    }
    ['Top', 'Right', 'Bottom', 'Left'].forEach((side) => {
      const c = cs[`border${side}Color`];
      const w = cs[`border${side}Width`];
      if (w && w !== '0px' && c) dest.style.setProperty(`border-${side.toLowerCase()}-color`, c, 'important');
    });
  }
}

/** @param {string} cssColor */
function isDarkColor(cssColor) {
  const m = String(cssColor).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return false;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
}

function collectStylesheetHtml() {
  return [...document.querySelectorAll('style, link[rel="stylesheet"]')]
    .map((node) => {
      if (node.tagName === 'LINK') {
        const href = node.href || node.getAttribute('href') || '';
        if (!href) return '';
        return `<link rel="stylesheet" href="${escapeAttr(href)}">`;
      }
      return `<style>${node.textContent || ''}</style>`;
    })
    .join('\n');
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

/**
 * @param {Window} win
 * @param {string} html
 * @param {Node} clone
 */
function writeAndPrint(win, html, clone, fileName) {
  const doc = win.document;
  doc.open();
  doc.write(html);
  doc.close();
  if (fileName) doc.title = fileName;
  doc.body.appendChild(clone);

  const runPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  };

  const after = () => {
    try { win.close(); } catch { /* ignore */ }
  };
  win.addEventListener('afterprint', after);
  waitForImages(doc).then(() => {
    win.setTimeout(runPrint, 250);
  });
}

/**
 * @param {string} html
 * @param {Node} clone
 */
function printViaSizedIframe(html, clone, fileName) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100vw',
    'height:100vh',
    'border:0',
    'z-index:2147483646',
    'background:#fff',
  ].join(';');
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();
  if (fileName) doc.title = fileName;
  doc.body.appendChild(clone);

  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 400);
  };
  win.addEventListener('afterprint', cleanup);

  waitForImages(doc).then(() => {
    win.setTimeout(() => {
      try {
        win.focus();
        win.print();
      } finally {
        window.setTimeout(cleanup, 4000);
      }
    }, 250);
  });
}

/** @param {Document} doc */
function waitForImages(doc) {
  const pending = [...doc.images].map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
  });
  return Promise.all(pending);
}
