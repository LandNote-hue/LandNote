import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../db.js';
import { BOARD, BOARD_BTN, BOARD_INPUT } from '../../theme/boardTheme.js';
import { BOARD_KIND } from '../../data/boardSeed.js';
import {
  addBoardPost, boardFileFromInput, boardPathLabel, boardUserKey,
  BOARD_FILE_MAX_BYTES, BOARD_FILE_MAX_COUNT, ensureBoardSeed, fmtBoardFileSize,
  isBoardInlineImage, isBoardVideoFile, leafBoards, prefixesOf, updateBoardPost,
} from '../../services/board/boardStore.js';
import { BoardIco, comingSoon } from './boardUi.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

const FONTS = ['Pretendard', '돋움', '굴림', '바탕', 'Arial'];
const SIZES = ['12px', '14px', '16px', '18px', '24px'];
const PHASE5 = new Set(['이미지 편집', '스티커', '번역', '설문', '템플릿']);

function ToolBtn({ label, title, onClick, active, children }) {
  return (
    <button type="button" title={title || label} onClick={onClick}
      style={{
        height: 30, minWidth: 30, padding: children && label ? '0 8px' : 0, border: 'none',
        borderRadius: 6, background: active ? BOARD.brandL : 'transparent', color: active ? BOARD.brand : BOARD.txS,
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
      {children}{label}
    </button>
  );
}

export default function BoardWritePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('edit');
  const { accountDefaults } = useAuth();
  const editorRef = useRef(null);
  const fileRef = useRef(null);
  const imgRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [boardId, setBoardId] = useState(2);
  const [picker, setPicker] = useState(false);
  const [prefix, setPrefix] = useState('');
  const [title, setTitle] = useState('');
  const [must, setMust] = useState(false);
  const [notice, setNotice] = useState(false);
  const [important, setImportant] = useState(false);
  const [wide, setWide] = useState(false);
  const [extraOpen, setExtraOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [font, setFont] = useState('Pretendard');
  const [fontSize, setFontSize] = useState('14px');
  const [files, setFiles] = useState([]);
  const [source, setSource] = useState(false);
  const [html, setHtml] = useState('');
  const [banner, setBanner] = useState('');

  useEffect(() => { ensureBoardSeed().finally(() => setReady(true)); }, []);
  const boards = useLiveQuery(() => (ready ? db.boards.toArray() : []), [ready]) || [];
  const board = boards.find((b) => b.id === Number(boardId));
  const prefixes = prefixesOf(board);

  useEffect(() => {
    if (!editId || !ready) return;
    db.board_posts.get(Number(editId)).then((p) => {
      if (!p) return;
      setBoardId(p.boardId);
      setPrefix(p.prefix || '');
      setTitle(p.title || '');
      setMust(!!p.isMustRead);
      setNotice(!!p.isNotice);
      setImportant(!!p.isImportant);
      setFiles(Array.isArray(p.files) ? p.files : []);
      setHtml(p.bodyHtml || '');
      if (editorRef.current) editorRef.current.innerHTML = p.bodyHtml || '';
    });
  }, [editId, ready]);

  useEffect(() => {
    if (prefix && !prefixes.includes(prefix)) setPrefix('');
  }, [boardId, prefixes, prefix]);

  useEffect(() => {
    const leaves = leafBoards(boards);
    if (!leaves.length) return;
    if (!leaves.some((b) => b.id === Number(boardId))) setBoardId(leaves[0].id);
  }, [boards, boardId]);

  const exec = (cmd, val) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const onPhase = (label) => {
    if (PHASE5.has(label)) comingSoon(label);
  };

  const bodyHtml = () => (source ? html : (editorRef.current?.innerHTML || html || ''));

  const save = async ({ draft }) => {
    if (!boardId) { window.alert('게시판을 선택하세요.'); return; }
    if (!String(title).trim()) { window.alert('제목을 입력하세요.'); return; }
    const payload = {
      boardId: Number(boardId),
      prefix,
      title: String(title).slice(0, 200),
      bodyHtml: bodyHtml(),
      authorName: accountDefaults?.displayName || '사용자',
      authorKey: boardUserKey(),
      isMustRead: must,
      isNotice: notice,
      isImportant: important,
      isDraft: !!draft,
      files,
    };
    if (editId) await updateBoardPost(editId, payload);
    else await addBoardPost(payload);
    if (draft) {
      setBanner('임시저장했습니다.');
      setTimeout(() => setBanner(''), 2200);
      return;
    }
    navigate('/board');
  };

  const insertHtml = (snippet) => {
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, snippet);
  };

  const addAttachments = async (list) => {
    const incoming = [...list];
    if (!incoming.length) return;
    const room = BOARD_FILE_MAX_COUNT - files.length;
    if (room <= 0) {
      window.alert(`첨부파일은 최대 ${BOARD_FILE_MAX_COUNT}개까지 가능합니다.`);
      return;
    }
    const slice = incoming.slice(0, room);
    if (incoming.length > room) {
      window.alert(`첨부파일은 최대 ${BOARD_FILE_MAX_COUNT}개까지라 앞 ${room}개만 추가합니다.`);
    }
    const next = [];
    for (const file of slice) {
      try {
        next.push(await boardFileFromInput(file));
      } catch (err) {
        const msg = String(err?.message || '');
        if (msg.startsWith('FILE_TOO_LARGE:')) {
          window.alert(`${msg.slice('FILE_TOO_LARGE:'.length)} 파일이 ${Math.round(BOARD_FILE_MAX_BYTES / (1024 * 1024))}MB를 초과합니다.`);
        } else {
          window.alert(`${file.name} 파일을 읽지 못했습니다.`);
        }
      }
    }
    if (next.length) setFiles((prev) => [...prev, ...next]);
  };

  const insertInlineImages = (list) => {
    [...list].forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => insertHtml(`<img src="${reader.result}" alt="" style="max-width:100%" />`);
      reader.readAsDataURL(file);
    });
  };

  const onFiles = (list, asImage) => {
    const arr = [...list];
    if (!arr.length) return;
    if (asImage) {
      insertInlineImages(arr);
      return;
    }
    addAttachments(arr);
  };

  const onEditorDrop = (e) => {
    const dropped = [...(e.dataTransfer?.files || [])];
    if (!dropped.length) return;
    e.preventDefault();
    const images = dropped.filter((f) => isBoardInlineImage(f) && !isBoardVideoFile(f));
    const others = dropped.filter((f) => !images.includes(f));
    if (images.length) insertInlineImages(images);
    if (others.length) addAttachments(others);
  };

  const leaves = leafBoards(boards);
  const folders = boards.filter((b) => b.kind === BOARD_KIND.FOLDER);

  const extraTools = [
    { label: '파일첨부', on: () => fileRef.current?.click() },
    { label: '표', on: () => insertHtml('<table style="border-collapse:collapse;width:100%;margin:8px 0"><tr><td style="border:1px solid #E8EAED;padding:8px">내용</td><td style="border:1px solid #E8EAED;padding:8px">내용</td></tr><tr><td style="border:1px solid #E8EAED;padding:8px"></td><td style="border:1px solid #E8EAED;padding:8px"></td></tr></table>') },
    { label: '이미지', on: () => imgRef.current?.click() },
    { label: '이미지 편집', on: () => onPhase('이미지 편집') },
    { label: '스티커', on: () => onPhase('스티커') },
    { label: '동영상', on: () => {
      const url = window.prompt('동영상 URL을 입력하세요.');
      if (url) insertHtml(`<p><a href="${url}">${url}</a></p>`);
    } },
    { label: '번역', on: () => onPhase('번역') },
    { label: '설문', on: () => onPhase('설문') },
    { label: '템플릿', on: () => onPhase('템플릿') },
    { label: '에디터', on: () => {
      if (source) {
        if (editorRef.current) editorRef.current.innerHTML = html;
        setSource(false);
      } else {
        setHtml(editorRef.current?.innerHTML || '');
        setSource(true);
      }
    } },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BOARD.bg, minHeight: 0 }}>
      <PageHeader title={editId ? '게시글 수정' : '글쓰기'} sub="게시판" />
      <div style={{ background: BOARD.surf, borderBottom: `1px solid ${BOARD.bdr}`, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', flexShrink: 0, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => save({ draft: false })}
          style={{ ...BOARD_BTN, background: BOARD.brand, borderColor: BOARD.brand, color: '#fff', fontWeight: 700, minWidth: 72 }}>등록</button>
        <button type="button" onClick={() => { const n = !(must || notice); setMust(n); setNotice(n); }}
          style={{ ...BOARD_BTN, background: (must || notice) ? BOARD.brandL : '#fff', borderColor: (must || notice) ? BOARD.brand : BOARD.bdrSt, color: (must || notice) ? BOARD.brand : BOARD.txS }}>공지</button>
        <button type="button" onClick={() => save({ draft: true })} style={BOARD_BTN}>임시저장</button>
        <button type="button" onClick={() => setPreview(true)} style={BOARD_BTN}>미리보기</button>
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setSettingsOpen((v) => !v)} style={BOARD_BTN}><BoardIco.gear size={14} /> 게시글 설정</button>
          {settingsOpen && (
            <div style={{ position: 'absolute', top: 40, left: 0, zIndex: 20, background: '#fff', border: `1px solid ${BOARD.bdr}`, borderRadius: 8, padding: 12, minWidth: 160, boxShadow: '0 8px 24px rgba(15,23,42,.12)' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: BOARD.txS, cursor: 'pointer' }}>
                <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} /> 중요글
              </label>
            </div>
          )}
        </div>
        <button type="button" onClick={() => setWide((v) => !v)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: BOARD.txS, cursor: 'pointer', border: 'none', background: 'transparent', fontFamily: 'inherit' }}>
          본문 넓게 보기
          <span style={{ width: 40, height: 22, borderRadius: 11, background: wide ? BOARD.brand : '#CBD5E1', position: 'relative', display: 'inline-block' }}>
            <span style={{ position: 'absolute', top: 3, left: wide ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
          </span>
        </button>
      </div>

      {banner && <div style={{ margin: '0 24px 8px', padding: '8px 12px', background: '#ECFDF5', color: '#047857', borderRadius: 7, fontSize: 13 }}>{banner}</div>}

      <div style={{ flex: 1, overflowY: 'auto', padding: wide ? '8px 16px 24px' : '8px 24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 12, alignItems: 'center', marginBottom: 12, maxWidth: wide ? '100%' : 1100, marginLeft: 'auto', marginRight: 'auto' }}>
          <div style={{ fontSize: 13, color: BOARD.txS, fontWeight: 600 }}>게시판</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => setPicker(true)} style={{ ...BOARD_BTN, minWidth: 110 }}>게시판 선택</button>
            <span style={{ fontSize: 13, color: BOARD.tx }}>{boardPathLabel(boards, boardId) || '게시판을 선택하세요'}</span>
          </div>
          <div style={{ fontSize: 13, color: BOARD.txS, fontWeight: 600 }}>제목</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select value={prefix} onChange={(e) => setPrefix(e.target.value)}
              style={{ ...BOARD_INPUT, width: 150, flexShrink: 0 }}>
              <option value="">말머리 선택 안 함</option>
              {prefixes.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요"
              style={{ ...BOARD_INPUT, flex: 1, minWidth: 0 }} />
            <span style={{ width: 52, textAlign: 'right', fontSize: 12, color: BOARD.txP }}>{String(title).length}/200</span>
          </div>
        </div>

        <div style={{ maxWidth: wide ? '100%' : 1100, margin: '0 auto', background: BOARD.surf, border: `1px solid ${BOARD.bdr}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderBottom: `1px solid ${BOARD.bdr}`, flexWrap: 'wrap' }}>
            <select value={font} onChange={(e) => { setFont(e.target.value); exec('fontName', e.target.value); }}
              style={{ ...BOARD_INPUT, width: 120, height: 30, minHeight: 30, fontSize: 12 }}>{FONTS.map((f) => <option key={f}>{f}</option>)}</select>
            <select value={fontSize} onChange={(e) => { setFontSize(e.target.value); exec('fontSize', '3'); if (editorRef.current) editorRef.current.style.fontSize = e.target.value; }}
              style={{ ...BOARD_INPUT, width: 72, height: 30, minHeight: 30, fontSize: 12 }}>{SIZES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <ToolBtn title="굵게" onClick={() => exec('bold')}><b>B</b></ToolBtn>
            <ToolBtn title="기울임" onClick={() => exec('italic')}><i>I</i></ToolBtn>
            <ToolBtn title="밑줄" onClick={() => exec('underline')}><u>U</u></ToolBtn>
            <ToolBtn title="취소선" onClick={() => exec('strikeThrough')}><s>S</s></ToolBtn>
            <ToolBtn title="글자색" onClick={() => exec('foreColor', BOARD.brand)}><span style={{ color: BOARD.brand, fontWeight: 800 }}>가</span></ToolBtn>
            <ToolBtn title="배경색" onClick={() => exec('hiliteColor', '#FEF3C7')}><span style={{ background: '#FEF3C7', padding: '0 3px' }}>가</span></ToolBtn>
            <ToolBtn title="왼쪽" onClick={() => exec('justifyLeft')}>≡</ToolBtn>
            <ToolBtn title="가운데" onClick={() => exec('justifyCenter')}>≡</ToolBtn>
            <ToolBtn title="오른쪽" onClick={() => exec('justifyRight')}>≡</ToolBtn>
            <ToolBtn title="양쪽" onClick={() => exec('justifyFull')}>≡</ToolBtn>
            <ToolBtn title="서식 지우기" onClick={() => exec('removeFormat')}>Tx</ToolBtn>
            <ToolBtn title="인용" onClick={() => exec('formatBlock', 'blockquote')}>❝</ToolBtn>
            <ToolBtn title="목록" onClick={() => exec('insertUnorderedList')}>•</ToolBtn>
            <ToolBtn title="링크" onClick={() => { const url = window.prompt('링크 URL'); if (url) exec('createLink', url); }}>🔗</ToolBtn>
            <div style={{ marginLeft: 'auto' }}>
              <ToolBtn label="추가기능" active={extraOpen} onClick={() => setExtraOpen((v) => !v)} />
            </div>
          </div>
          {extraOpen && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px', borderBottom: `1px solid ${BOARD.bdr}`, flexWrap: 'wrap', background: BOARD.surf2 }}>
              {extraTools.map((t) => (
                <ToolBtn key={t.label} label={t.label} onClick={t.on} />
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onFiles(e.target.files, false); e.target.value = ''; }} />
          <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files, true); e.target.value = ''; }} />
          {source ? (
            <textarea value={html} onChange={(e) => setHtml(e.target.value)}
              style={{ width: '100%', minHeight: 420, border: 'none', padding: 28, fontSize: 14, fontFamily: 'ui-monospace, monospace', resize: 'vertical', outline: 'none' }} />
          ) : (
            <div
              ref={editorRef}
              className="board-editor"
              contentEditable
              data-placeholder="내용을 입력하거나 드래그 앤 드롭으로 파일, 이미지, 동영상(단, .mp4, .mov 확장자만 첨부 가능)을 첨부해보세요."
              style={{ minHeight: 420, padding: 28, fontSize: fontSize === '14px' ? 14 : undefined, fontFamily: font, outline: 'none', color: BOARD.tx, lineHeight: 1.7, background: '#fff' }}
              onInput={() => setHtml(editorRef.current?.innerHTML || '')}
              onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
              onDrop={onEditorDrop}
            />
          )}
        </div>

        <div style={{
          maxWidth: wide ? '100%' : 1100, margin: '14px auto 0', background: BOARD.surf,
          border: `1px solid ${BOARD.bdr}`, borderRadius: 10, padding: '14px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: BOARD.tx, minWidth: 72 }}>첨부파일</div>
            <button type="button" onClick={() => fileRef.current?.click()}
              style={{ ...BOARD_BTN, background: BOARD.brandL, borderColor: BOARD.brand, color: BOARD.brand }}>
              <BoardIco.paperclip size={14} /> 파일 선택
            </button>
            <span style={{ fontSize: 12, color: BOARD.txP }}>
              파일당 {Math.round(BOARD_FILE_MAX_BYTES / (1024 * 1024))}MB · 최대 {BOARD_FILE_MAX_COUNT}개 · {files.length}/{BOARD_FILE_MAX_COUNT}
            </span>
          </div>
          <div
            onDragOver={(e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); }}
            onDrop={(e) => {
              const dropped = [...(e.dataTransfer?.files || [])];
              if (!dropped.length) return;
              e.preventDefault();
              addAttachments(dropped);
            }}
            onClick={() => { if (!files.length) fileRef.current?.click(); }}
            style={{
              marginTop: 10, minHeight: 72, border: `1.5px dashed ${BOARD.bdrSt}`, borderRadius: 8,
              padding: files.length ? '8px 10px' : '18px 12px', background: BOARD.surf2, cursor: 'pointer',
            }}
          >
            {files.length === 0 ? (
              <div style={{ textAlign: 'center', fontSize: 13, color: BOARD.txP, lineHeight: 1.55 }}>
                파일을 선택하거나 이 칸에 끌어다 놓으세요.<br />
                PDF, 엑셀, 이미지, zip, mp4, mov 등을 첨부할 수 있습니다.
              </div>
            ) : (
              files.map((f, i) => (
                <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}
                  onClick={(e) => e.stopPropagation()}>
                  <BoardIco.paperclip size={13} />
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: BOARD.txS }}>{f.name}</span>
                  <span style={{ color: BOARD.txP, fontSize: 12 }}>{fmtBoardFileSize(f.size)}</span>
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    style={{ ...BOARD_BTN, height: 28, minHeight: 28, padding: '0 8px', fontSize: 12 }}>삭제</button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {picker && (
        <div onClick={() => setPicker(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.35)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 380, maxHeight: 480, overflowY: 'auto', background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 16px 40px rgba(15,23,42,.18)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>게시판 선택</div>
            {folders.map((folder) => (
              <div key={folder.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: BOARD.txP, fontWeight: 700, margin: '6px 0' }}>{folder.name}</div>
                {leaves.filter((b) => b.parentId === folder.id).map((b) => (
                  <button key={b.id} type="button" onClick={() => { setBoardId(b.id); setPicker(false); }}
                    style={{
                      width: '100%', textAlign: 'left', height: 36, border: 'none', borderRadius: 7, cursor: 'pointer',
                      background: boardId === b.id ? BOARD.brandL : 'transparent', color: boardId === b.id ? BOARD.brand : BOARD.tx,
                      fontWeight: boardId === b.id ? 700 : 400, fontFamily: 'inherit', fontSize: 14, padding: '0 10px',
                    }}>{b.name}</button>
                ))}
              </div>
            ))}
            {leaves.filter((b) => b.parentId == null).length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: BOARD.txP, fontWeight: 700, margin: '6px 0' }}>폴더 없음</div>
                {leaves.filter((b) => b.parentId == null).map((b) => (
                  <button key={b.id} type="button" onClick={() => { setBoardId(b.id); setPicker(false); }}
                    style={{
                      width: '100%', textAlign: 'left', height: 36, border: 'none', borderRadius: 7, cursor: 'pointer',
                      background: boardId === b.id ? BOARD.brandL : 'transparent', color: boardId === b.id ? BOARD.brand : BOARD.tx,
                      fontWeight: boardId === b.id ? 700 : 400, fontFamily: 'inherit', fontSize: 14, padding: '0 10px',
                    }}>{b.name}</button>
                ))}
              </div>
            )}
            {leaves.length === 0 && <div style={{ fontSize: 13, color: BOARD.txP }}>등록된 게시판이 없습니다. 게시판 관리에서 추가하세요.</div>}
          </div>
        </div>
      )}

      {preview && (
        <div onClick={() => setPreview(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '80vh', overflowY: 'auto', background: '#fff', borderRadius: 12, padding: 28 }}>
            <div style={{ fontSize: 12, color: BOARD.txM, marginBottom: 8 }}>{boardPathLabel(boards, boardId)}</div>
            <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>{prefix ? `[${prefix}] ${title}` : (title || '(제목 없음)')}</h2>
            <div dangerouslySetInnerHTML={{ __html: bodyHtml() || '<p style="color:#94A3B8">내용 없음</p>' }} />
            <button type="button" onClick={() => setPreview(false)} style={{ ...BOARD_BTN, marginTop: 20 }}>닫기</button>
          </div>
        </div>
      )}

      <style>{`.board-editor:empty:before{content:attr(data-placeholder);color:#94A3B8;pointer-events:none}`}</style>
    </div>
  );
}
