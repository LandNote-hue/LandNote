import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db.js';
import { BOARD, BOARD_BTN } from '../../theme/boardTheme.js';
import {
  boardUserKey, ensureBoardSeed, filterBoardPosts, fmtBoardDate, isUnread, postTitleLabel,
} from '../../services/board/boardStore.js';
import { ImportantBadge, MustBadge, UnreadDot } from '../board/boardUi.jsx';
import BoardPostPage from '../board/BoardPostPage.jsx';
import BoardWritePage from '../board/BoardWritePage.jsx';

export function MobileBoardList() {
  const navigate = useNavigate();
  const userKey = boardUserKey();
  const [ready, setReady] = useState(false);
  useEffect(() => { ensureBoardSeed().finally(() => setReady(true)); }, []);
  const boards = useLiveQuery(() => (ready ? db.boards.toArray() : []), [ready]) || [];
  const posts = useLiveQuery(() => (ready ? db.board_posts.toArray() : []), [ready]) || [];
  const reads = useLiveQuery(() => (ready ? db.board_reads.where('userKey').equals(userKey).toArray() : []), [ready, userKey]) || [];
  const rows = useMemo(() => filterBoardPosts(posts, {
    view: 'all', boards, favIds: [], userKey, q: '',
  }), [posts, boards, userKey]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BOARD.bg }}>
      <div style={{ padding: '12px 16px', background: BOARD.surf, borderBottom: `1px solid ${BOARD.bdr}`, display: 'flex', alignItems: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>게시판</div>
        <button type="button" onClick={() => navigate('/board/write')}
          style={{ ...BOARD_BTN, marginLeft: 'auto', background: BOARD.brand, borderColor: BOARD.brand, color: '#fff', height: 32, minHeight: 32 }}>글쓰기</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {rows.map((p) => {
          const unread = isUnread(p, reads, userKey);
          return (
            <button key={p.id} type="button" onClick={() => navigate(`/board/${p.id}`)}
              style={{
                width: '100%', textAlign: 'left', border: 'none', borderBottom: `1px solid ${BOARD.bdr}`,
                background: unread ? '#FFF8F9' : '#fff', padding: '12px 16px', cursor: 'pointer', fontFamily: 'inherit',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: unread ? 700 : 500, color: BOARD.tx }}>
                {unread && <UnreadDot />}
                {(p.isNotice || p.isMustRead) && <MustBadge />}
                {p.isImportant && <ImportantBadge />}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{postTitleLabel(p)}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: BOARD.txP }}>{p.authorName} · {fmtBoardDate(p.updatedAt)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MobileBoardPost() {
  return <BoardPostPage />;
}

export function MobileBoardWrite() {
  return <BoardWritePage />;
}
