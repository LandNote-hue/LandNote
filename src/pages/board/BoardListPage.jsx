import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db.js';
import { BOARD, BOARD_BTN, BOARD_INPUT } from '../../theme/boardTheme.js';
import { BOARD_KIND } from '../../data/boardSeed.js';
import {
  boardUserKey, childBoardIds, commentsByPostId, ensureBoardSeed, filterBoardPosts, fmtBoardDate,
  isBoardNotice, isUnread, leafBoards, markPostsRead,
  postSearchHaystack, postTitleLabel, sortBoardPosts, toggleBoardFav,
} from '../../services/board/boardStore.js';
import { BoardIco, ImportantBadge, MustBadge, NotifyDot, UnreadDot } from './boardUi.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import BoardManageModal from './BoardManageModal.jsx';

function viewTitle(view, boards, boardId, folderId) {
  if (view === 'all') return '전체 게시글';
  if (view === 'fav') return '즐겨찾기';
  if (view === 'trash') return '휴지통';
  if (view === 'board') return boards.find((b) => b.id === Number(boardId))?.name || '게시판';
  if (view === 'folder') return boards.find((b) => b.id === Number(folderId))?.name || '게시판';
  return '전체 게시글';
}

export default function BoardListPage() {
  const navigate = useNavigate();
  const { accountDefaults } = useAuth();
  const userKey = boardUserKey();
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('all');
  const [boardId, setBoardId] = useState(null);
  const [folderId, setFolderId] = useState(null);
  const [treeQ, setTreeQ] = useState('');
  const [postQ, setPostQ] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('new');
  const [layout, setLayout] = useState('list');
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    ensureBoardSeed().finally(() => setReady(true));
  }, []);

  const boards = useLiveQuery(() => (ready ? db.boards.orderBy('sort').toArray() : []), [ready]) || [];
  const posts = useLiveQuery(() => (ready ? db.board_posts.toArray() : []), [ready]) || [];
  const comments = useLiveQuery(() => (ready ? db.board_comments.toArray() : []), [ready]) || [];
  const reads = useLiveQuery(() => (ready ? db.board_reads.where('userKey').equals(userKey).toArray() : []), [ready, userKey]) || [];
  const favs = useLiveQuery(() => (ready ? db.board_favs.where('userKey').equals(userKey).toArray() : []), [ready, userKey]) || [];
  const favIds = favs.map((f) => f.boardId);

  const filtered = useMemo(() => {
    const rows = filterBoardPosts(posts, {
      view, boardId, folderId, boards, favIds, userKey, q: postQ || treeQ, comments,
    });
    if (sort === 'old') return sortBoardPosts(rows, { dir: 'old' });
    if (sort === 'title') return sortBoardPosts(rows, { by: 'title' });
    return sortBoardPosts(rows);
  }, [posts, comments, view, boardId, folderId, boards, favIds, userKey, postQ, treeQ, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hideBoardCol = view === 'board';
  const title = viewTitle(view, boards, boardId, folderId);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [view, boardId, folderId, postQ, treeQ, pageSize, sort]);

  const goTree = (next) => {
    setView(next.view);
    setBoardId(next.boardId ?? null);
    setFolderId(next.folderId ?? null);
  };

  const toggleSel = (id) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };
  const allChecked = pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));
  const toggleAll = () => {
    if (allChecked) setSelected(new Set());
    else setSelected(new Set(pageRows.map((p) => p.id)));
  };

  const onRead = async () => {
    if (!selected.size) return;
    await markPostsRead([...selected], userKey);
    setSelected(new Set());
  };

  const folders = boards.filter((b) => b.kind === BOARD_KIND.FOLDER).sort((a, c) => (a.sort || 0) - (c.sort || 0) || a.id - c.id);
  const topBoards = leafBoards(boards).filter((b) => b.parentId == null);
  const commentMap = useMemo(() => commentsByPostId(comments), [comments]);
  const treeNeedle = treeQ.trim().toLowerCase();
  const boardMatchesSearch = (board) => {
    if (!treeNeedle) return true;
    if (!board) return false;
    if (String(board.name || '').toLowerCase().includes(treeNeedle)) return true;
    const ids = board.kind === BOARD_KIND.FOLDER
      ? [board.id, ...childBoardIds(boards, board.id)]
      : [board.id];
    return posts.some((p) => ids.includes(p.boardId) && !p.deletedAt && postSearchHaystack(p, boards, commentMap).includes(treeNeedle));
  };

  useEffect(() => {
    if (view === 'board' && boardId && !boards.some((b) => b.id === Number(boardId))) {
      setView('all'); setBoardId(null);
    }
    if (view === 'folder' && folderId && !boards.some((b) => b.id === Number(folderId))) {
      setView('all'); setFolderId(null);
    }
  }, [boards, view, boardId, folderId]);

  const treeItem = (key, active, onClick, icon, label, extra) => (
    <button key={key} type="button" onClick={onClick}
      style={{
        flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 34,
        padding: '0 10px', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
        background: active ? BOARD.brandL : 'transparent', color: active ? BOARD.brand : BOARD.txS,
        fontSize: 13, fontWeight: active ? 600 : 400, textAlign: 'left',
      }}>
      <span style={{ color: active ? BOARD.brand : BOARD.txM, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {extra}
    </button>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BOARD.bg, minHeight: 0 }}>
      <PageHeader
        title="게시판"
        sub={`${title} ${filtered.length}건`}
        ch={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 20, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, background: '#fff', border: `1.5px solid ${BOARD.bdr}`, borderRadius: 7, padding: '0 12px', flex: 1, maxWidth: 420 }}>
              <span style={{ display: 'inline-flex', color: BOARD.txP }}><BoardIco.search size={15} /></span>
              <input value={postQ} onChange={(e) => setPostQ(e.target.value)} placeholder="게시글 · 본문 · 댓글 · 작성자 검색"
                style={{ border: 'none', background: 'transparent', fontSize: 14, color: BOARD.tx, flex: 1, height: '100%', fontFamily: 'inherit', outline: 'none' }} />
            </div>
          </div>
        }
        acts={
          <button type="button" onClick={() => setManageOpen(true)} style={{ ...BOARD_BTN, background: '#fff' }}>
            게시판 관리
          </button>
        }
      />
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <aside style={{ width: BOARD.innerW, flexShrink: 0, background: BOARD.surf, borderRight: `1px solid ${BOARD.bdr}`, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: 14, paddingBottom: 10 }}>
            <button type="button" onClick={() => navigate('/board/write')}
              style={{ ...BOARD_BTN, width: '100%', background: BOARD.brand, borderColor: BOARD.brand, color: '#fff', fontWeight: 700, fontSize: 14, gap: 8 }}>
              <BoardIco.write size={15} /> 글쓰기
            </button>
            <div style={{ position: 'relative', marginTop: 12 }}>
              <span style={{ position: 'absolute', left: 10, top: 9, color: BOARD.txP }}><BoardIco.search size={14} /></span>
              <input className="inp" value={treeQ} onChange={(e) => setTreeQ(e.target.value)} placeholder="게시판 · 게시글 · 댓글 검색"
                style={{ ...BOARD_INPUT, paddingLeft: 30, width: '100%', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 16px' }}>
            {treeItem('all', view === 'all', () => goTree({ view: 'all' }), <BoardIco.list size={14} />, '전체 게시글')}
            <div style={{ padding: '6px 10px 4px', fontSize: 11, fontWeight: 700, color: BOARD.txP, letterSpacing: '.04em' }}>즐겨찾기</div>
            {favIds.length === 0 ? (
              <div style={{ padding: '18px 12px 16px', textAlign: 'center', color: BOARD.txP, fontSize: 12, lineHeight: 1.55 }}>
                <div style={{ marginBottom: 8, color: '#E2E8F0', display: 'flex', justifyContent: 'center' }}><BoardIco.star size={28} /></div>
                자주 찾는 게시판의 이름 옆 별 아이콘을<br />클릭하면 즐겨찾기로 추가할 수 있어요.
              </div>
            ) : (
              leafBoards(boards).filter((b) => favIds.includes(b.id) && boardMatchesSearch(b)).map((b) =>
                treeItem(`fav-${b.id}`, view === 'board' && boardId === b.id, () => goTree({ view: 'board', boardId: b.id }), <BoardIco.clip size={14} />, b.name, b.notify ? <NotifyDot /> : null)
              )
            )}
            <div style={{ padding: '10px 10px 4px', fontSize: 11, fontWeight: 700, color: BOARD.txP, letterSpacing: '.04em' }}>
              전체 게시판
            </div>
            {folders.filter((f) => boardMatchesSearch(f)).map((folder) => {
              const kids = leafBoards(boards).filter((b) => b.parentId === folder.id);
              const folderActive = view === 'folder' && folderId === folder.id;
              return (
                <div key={folder.id}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {treeItem(`folder-${folder.id}`, folderActive, () => goTree({ view: 'folder', folderId: folder.id }), <BoardIco.folder size={14} />, folder.name, folder.notify ? <NotifyDot /> : null)}
                  </div>
                  {kids.filter((b) => boardMatchesSearch(b) || boardMatchesSearch(folder)).map((b) => {
                    const starred = favIds.includes(b.id);
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', paddingLeft: 22 }}>
                        {treeItem(`board-${b.id}`, view === 'board' && boardId === b.id, () => goTree({ view: 'board', boardId: b.id }), <BoardIco.clip size={14} />, b.name, b.notify ? <NotifyDot /> : null)}
                        <button type="button" title={starred ? '즐겨찾기 해제' : '즐겨찾기'}
                          onClick={() => toggleBoardFav(b.id, userKey)}
                          style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: starred ? BOARD.brand : BOARD.txP, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {starred ? <BoardIco.starFill size={13} /> : <BoardIco.star size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {topBoards.filter((b) => boardMatchesSearch(b)).map((b) => {
              const starred = favIds.includes(b.id);
              return (
                <div key={`top-${b.id}`} style={{ display: 'flex', alignItems: 'center' }}>
                  {treeItem(`board-${b.id}`, view === 'board' && boardId === b.id, () => goTree({ view: 'board', boardId: b.id }), <BoardIco.clip size={14} />, b.name, b.notify ? <NotifyDot /> : null)}
                  <button type="button" title={starred ? '즐겨찾기 해제' : '즐겨찾기'}
                    onClick={() => toggleBoardFav(b.id, userKey)}
                    style={{ width: 28, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', color: starred ? BOARD.brand : BOARD.txP, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {starred ? <BoardIco.starFill size={13} /> : <BoardIco.star size={13} />}
                  </button>
                </div>
              );
            })}
            <div style={{ height: 8 }} />
            {treeItem('trash', view === 'trash', () => goTree({ view: 'trash' }), <BoardIco.trash size={15} />, '휴지통')}
          </div>
        </aside>

        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: BOARD.bg }}>
          <div style={{ background: BOARD.surf, borderBottom: `1px solid ${BOARD.bdr}`, padding: '12px 24px 10px', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: BOARD.tx, letterSpacing: '-.01em' }}>{title}</div>
            </div>
          </div>

          <div style={{ background: BOARD.surf, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', borderBottom: `1px solid ${BOARD.bdr}`, flexShrink: 0 }}>
            <input type="checkbox" checked={allChecked} onChange={toggleAll} />
            <button type="button" disabled={!selected.size} onClick={onRead}
              style={{
                ...BOARD_BTN, height: 32, minHeight: 32, padding: '0 12px',
                opacity: selected.size ? 1 : 0.45, cursor: selected.size ? 'pointer' : 'default',
              }}>읽음</button>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                style={{ ...BOARD_INPUT, width: 110, height: 32, minHeight: 32, fontSize: 12 }}>
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}개씩 보기</option>)}
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value)}
                style={{ ...BOARD_INPUT, width: 92, height: 32, minHeight: 32, fontSize: 12 }}>
                <option value="new">최신순</option>
                <option value="old">오래된순</option>
                <option value="title">제목순</option>
              </select>
              <button type="button" onClick={() => setLayout('list')} title="목록"
                style={{ width: 32, height: 32, border: `1.5px solid ${layout === 'list' ? BOARD.brand : BOARD.bdr}`, borderRadius: 7, background: layout === 'list' ? BOARD.brandL : '#fff', color: layout === 'list' ? BOARD.brand : BOARD.txM, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BoardIco.list size={14} />
              </button>
              <button type="button" onClick={() => setLayout('cards')} title="카드"
                style={{ width: 32, height: 32, border: `1.5px solid ${layout === 'cards' ? BOARD.brand : BOARD.bdr}`, borderRadius: 7, background: layout === 'cards' ? BOARD.brandL : '#fff', color: layout === 'cards' ? BOARD.brand : BOARD.txM, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BoardIco.cards size={14} />
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', background: BOARD.surf }}>
            {pageRows.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center', color: BOARD.txP, fontSize: 14 }}>게시글이 없습니다.</div>
            )}
            {pageRows.map((p) => {
              const unread = isUnread(p, reads, userKey);
              const board = boards.find((b) => b.id === p.boardId);
              const on = selected.has(p.id);
              return (
                <div key={p.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: hideBoardCol ? '36px 1fr 110px' : '36px 1fr 120px 110px',
                    alignItems: 'center', minHeight: 56, padding: '8px 20px',
                    borderBottom: `1px solid ${BOARD.bdr}`, background: on ? BOARD.brandL : unread ? '#FFF8F9' : '#fff',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/board/${p.id}`)}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={on} onChange={() => toggleSel(p.id)} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      {unread && <UnreadDot />}
                      {isBoardNotice(p) && <MustBadge />}
                      {p.isImportant && <ImportantBadge />}
                      <span style={{ fontSize: 14, fontWeight: unread ? 700 : 500, color: BOARD.tx, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {postTitleLabel(p)}
                      </span>
                      {(p.hasFile || (p.files && p.files.length)) ? <span style={{ color: BOARD.txP }}><BoardIco.paperclip size={14} /></span> : null}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 12, color: BOARD.txP, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{p.authorName || accountDefaults?.displayName || '사용자'}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><BoardIco.comment size={12} />{p.commentCount || 0}</span>
                    </div>
                  </div>
                  {!hideBoardCol && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, color: BOARD.txM, fontSize: 12 }}>
                      <BoardIco.clip size={13} /> {board?.name || ''}
                    </div>
                  )}
                  <div style={{ textAlign: 'right', fontSize: 12, color: BOARD.txM }}>{fmtBoardDate(p.updatedAt || p.createdAt)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: BOARD.surf, borderTop: `1px solid ${BOARD.bdr}`, flexShrink: 0 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              style={{ ...BOARD_BTN, width: 32, padding: 0, height: 32, minHeight: 32, opacity: page <= 1 ? 0.4 : 1 }}>{'<'}</button>
            {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 7).map((n) => (
              <button key={n} type="button" onClick={() => setPage(n)}
                style={{
                  width: 32, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  background: n === page ? BOARD.brand : 'transparent', color: n === page ? '#fff' : BOARD.txS, fontWeight: 700, fontSize: 13,
                }}>{n}</button>
            ))}
            <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
              style={{ ...BOARD_BTN, width: 32, padding: 0, height: 32, minHeight: 32, opacity: page >= pages ? 0.4 : 1 }}>{'>'}</button>
          </div>
        </main>
      </div>
      {manageOpen && <BoardManageModal boards={boards} onClose={() => setManageOpen(false)} />}
    </div>
  );
}
