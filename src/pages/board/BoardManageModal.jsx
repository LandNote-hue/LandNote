import { useMemo, useState } from 'react';
import { BOARD, BOARD_BTN, BOARD_INPUT } from '../../theme/boardTheme.js';
import { BOARD_KIND } from '../../data/boardSeed.js';
import {
  createBoard, createBoardFolder, deleteBoardNode, leafBoards, prefixesOf,
  renameBoardPrefix, reorderBoardNode, updateBoardNode,
} from '../../services/board/boardStore.js';

const emptyForm = () => ({
  mode: 'list',
  editId: null,
  kind: BOARD_KIND.BOARD,
  name: '',
  parentId: '',
  prefixes: [],
  prefixDraft: '',
  editingPrefix: null,
  prefixEdit: '',
});

function Mini({ children, onClick, disabled, danger }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{
        ...BOARD_BTN, height: 28, minHeight: 28, padding: '0 8px', fontSize: 12,
        opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer',
        color: danger ? BOARD.brand : BOARD.txS,
        borderColor: danger ? BOARD.brand : BOARD.bdrSt,
      }}>
      {children}
    </button>
  );
}

export default function BoardManageModal({ boards, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [err, setErr] = useState('');

  const folders = useMemo(
    () => (boards || []).filter((b) => b.kind === BOARD_KIND.FOLDER).sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id),
    [boards],
  );
  const topBoards = useMemo(
    () => leafBoards(boards).filter((b) => b.parentId == null),
    [boards],
  );

  const patch = (p) => setForm((prev) => ({ ...prev, ...p }));

  const startAdd = (kind) => {
    setErr('');
    setForm({
      ...emptyForm(),
      mode: 'add',
      kind,
      parentId: kind === BOARD_KIND.BOARD && folders[0] ? String(folders[0].id) : '',
    });
  };

  const startEdit = (row) => {
    setErr('');
    setForm({
      ...emptyForm(),
      mode: 'edit',
      editId: row.id,
      kind: row.kind,
      name: row.name || '',
      parentId: row.parentId == null ? '' : String(row.parentId),
      prefixes: prefixesOf(row),
    });
  };

  const save = async () => {
    try {
      setErr('');
      if (form.mode === 'add' && form.kind === BOARD_KIND.FOLDER) {
        await createBoardFolder(form.name);
      } else if (form.mode === 'add') {
        await createBoard(form.name, form.parentId || null, form.prefixes);
      } else if (form.mode === 'edit') {
        await updateBoardNode(form.editId, {
          name: form.name,
          parentId: form.kind === BOARD_KIND.BOARD ? (form.parentId || null) : undefined,
          prefixes: form.kind === BOARD_KIND.BOARD ? form.prefixes : undefined,
        });
      }
      setForm(emptyForm());
    } catch (e) {
      if (e?.message === 'EMPTY_NAME') setErr('이름을 입력하세요.');
      else if (e?.message === 'INVALID_PARENT') setErr('상위 폴더를 확인하세요.');
      else setErr('저장하지 못했습니다.');
    }
  };

  const onDelete = async (row) => {
    const isFolder = row.kind === BOARD_KIND.FOLDER;
    const msg = isFolder
      ? `'${row.name}' 폴더와 안의 게시판을 삭제할까요? 게시글은 휴지통으로 이동합니다.`
      : `'${row.name}' 게시판을 삭제할까요? 게시글은 휴지통으로 이동합니다.`;
    if (!window.confirm(msg)) return;
    await deleteBoardNode(row.id);
    if (form.editId === row.id) setForm(emptyForm());
  };

  const addPrefix = () => {
    const s = form.prefixDraft.trim().slice(0, 20);
    if (!s) return;
    if (form.prefixes.includes(s)) { setErr('이미 있는 말머리입니다.'); return; }
    patch({ prefixes: [...form.prefixes, s], prefixDraft: '', });
    setErr('');
  };

  const applyPrefixEdit = async () => {
    const from = form.editingPrefix;
    const to = form.prefixEdit.trim().slice(0, 20);
    if (!to) return;
    const next = form.prefixes.map((p) => (p === from ? to : p));
    if (next.filter((p) => p === to).length > 1) { setErr('이미 있는 말머리입니다.'); return; }
    if (form.mode === 'edit' && form.editId && from !== to) {
      await renameBoardPrefix(form.editId, from, to);
    }
    patch({ prefixes: [...new Set(next)], editingPrefix: null, prefixEdit: '' });
    setErr('');
  };

  const rowBtns = (row, sibs) => {
    const i = sibs.findIndex((s) => s.id === row.id);
    return (
      <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <Mini disabled={i <= 0} onClick={() => reorderBoardNode(row.id, -1)}>위로</Mini>
        <Mini disabled={i >= sibs.length - 1} onClick={() => reorderBoardNode(row.id, 1)}>아래로</Mini>
        <Mini onClick={() => startEdit(row)}>수정</Mini>
        <Mini danger onClick={() => onDelete(row)}>삭제</Mini>
      </span>
    );
  };

  const formBox = form.mode !== 'list' && (
    <div style={{ marginTop: 14, padding: 14, border: `1px solid ${BOARD.bdr}`, borderRadius: 8, background: BOARD.surf2 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: BOARD.tx }}>
        {form.mode === 'add'
          ? (form.kind === BOARD_KIND.FOLDER ? '폴더 추가' : '게시판 추가')
          : (form.kind === BOARD_KIND.FOLDER ? '폴더 수정' : '게시판 수정')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 13, color: BOARD.txS }}>이름</div>
        <input value={form.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} placeholder="이름 입력"
          style={{ ...BOARD_INPUT, width: '100%' }} />
        {form.kind === BOARD_KIND.BOARD && (
          <>
            <div style={{ fontSize: 13, color: BOARD.txS }}>상위 폴더</div>
            <select value={form.parentId} onChange={(e) => patch({ parentId: e.target.value })}
              style={{ ...BOARD_INPUT, width: '100%' }}>
              <option value="">(폴더 없음)</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <div style={{ fontSize: 13, color: BOARD.txS, alignSelf: 'start', paddingTop: 8 }}>말머리</div>
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {form.prefixes.map((p) => (
                  <span key={p} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 8px',
                    borderRadius: 7, border: `1.5px solid ${BOARD.bdrSt}`, background: '#fff', fontSize: 12, color: BOARD.txS,
                  }}>
                    {form.editingPrefix === p ? (
                      <>
                        <input value={form.prefixEdit} maxLength={20} onChange={(e) => patch({ prefixEdit: e.target.value })}
                          style={{ ...BOARD_INPUT, height: 22, minHeight: 22, width: 90, padding: '0 6px', fontSize: 12 }} />
                        <button type="button" onClick={applyPrefixEdit} style={{ border: 'none', background: 'transparent', color: BOARD.brand, cursor: 'pointer', fontSize: 12 }}>저장</button>
                      </>
                    ) : (
                      <>
                        {p}
                        <button type="button" onClick={() => patch({ editingPrefix: p, prefixEdit: p })}
                          style={{ border: 'none', background: 'transparent', color: BOARD.txP, cursor: 'pointer', fontSize: 11 }}>수정</button>
                        <button type="button" onClick={() => patch({ prefixes: form.prefixes.filter((x) => x !== p) })}
                          style={{ border: 'none', background: 'transparent', color: BOARD.txP, cursor: 'pointer' }}>×</button>
                      </>
                    )}
                  </span>
                ))}
                {form.prefixes.length === 0 && <span style={{ fontSize: 12, color: BOARD.txP }}>말머리가 없습니다.</span>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={form.prefixDraft} maxLength={20} onChange={(e) => patch({ prefixDraft: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPrefix(); } }}
                  placeholder="말머리 추가" style={{ ...BOARD_INPUT, flex: 1, minWidth: 0 }} />
                <Mini onClick={addPrefix}>추가</Mini>
              </div>
            </div>
          </>
        )}
      </div>
      {err && <div style={{ marginTop: 10, fontSize: 12, color: BOARD.brand }}>{err}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => { setForm(emptyForm()); setErr(''); }} style={BOARD_BTN}>취소</button>
        <button type="button" onClick={save}
          style={{ ...BOARD_BTN, background: BOARD.brand, borderColor: BOARD.brand, color: '#fff' }}>저장</button>
      </div>
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.4)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(720px, 100%)', maxHeight: '84vh', overflow: 'hidden', background: '#fff', borderRadius: 12, boxShadow: '0 16px 40px rgba(15,23,42,.18)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${BOARD.bdr}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>게시판 관리</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => startAdd(BOARD_KIND.FOLDER)} style={BOARD_BTN}>폴더 추가</button>
            <button type="button" onClick={() => startAdd(BOARD_KIND.BOARD)}
              style={{ ...BOARD_BTN, background: BOARD.brand, borderColor: BOARD.brand, color: '#fff' }}>게시판 추가</button>
            <button type="button" onClick={onClose} style={BOARD_BTN}>닫기</button>
          </div>
        </div>
        <div style={{ padding: 16, overflowY: 'auto', minHeight: 0 }}>
          {folders.map((folder) => {
            const kids = leafBoards(boards).filter((b) => b.parentId === folder.id);
            return (
              <div key={folder.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '4px 6px', background: BOARD.surf2, borderRadius: 7 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: BOARD.tx }}>📁 {folder.name}</span>
                  {rowBtns(folder, folders)}
                </div>
                {kids.map((b) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '4px 6px 4px 22px' }}>
                    <span style={{ flex: 1, fontSize: 13, color: BOARD.txS }}>
                      {b.name}
                      {prefixesOf(b).length > 0 && (
                        <span style={{ marginLeft: 8, color: BOARD.txP, fontSize: 12 }}>{prefixesOf(b).join(', ')}</span>
                      )}
                    </span>
                    {rowBtns(b, kids)}
                  </div>
                ))}
              </div>
            );
          })}
          {topBoards.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: BOARD.txP, fontWeight: 700, margin: '8px 0 4px' }}>폴더 없음</div>
              {topBoards.map((b) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, padding: '4px 6px' }}>
                  <span style={{ flex: 1, fontSize: 13, color: BOARD.txS }}>
                    {b.name}
                    {prefixesOf(b).length > 0 && (
                      <span style={{ marginLeft: 8, color: BOARD.txP, fontSize: 12 }}>{prefixesOf(b).join(', ')}</span>
                    )}
                  </span>
                  {rowBtns(b, topBoards)}
                </div>
              ))}
            </div>
          )}
          {folders.length === 0 && topBoards.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: BOARD.txP, fontSize: 13 }}>폴더나 게시판이 없습니다. 먼저 추가하세요.</div>
          )}
          {formBox}
        </div>
      </div>
    </div>
  );
}
