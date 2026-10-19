import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../../db.js';
import { BOARD, BOARD_BTN, BOARD_INPUT } from '../../theme/boardTheme.js';
import {
  addBoardComment, boardFileHasData, boardPathLabel, boardUserKey, deleteBoardComment,
  downloadBoardFile, ensureBoardSeed, fmtBoardDate, fmtBoardFileSize, groupBoardComments,
  hardDeleteBoardPost, isBoardDeleted, markPostsRead, postTitleLabel, restoreBoardPost, trashBoardPost,
} from '../../services/board/boardStore.js';
import { BoardIco, ImportantBadge, MustBadge } from './boardUi.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';

function sanitizeHtml(html) {
  return String(html || '').replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
}

export default function BoardPostPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accountDefaults } = useAuth();
  const userKey = boardUserKey();
  const [ready, setReady] = useState(false);

  useEffect(() => { ensureBoardSeed().finally(() => setReady(true)); }, []);

  const post = useLiveQuery(() => (ready && id ? db.board_posts.get(Number(id)) : undefined), [ready, id]);
  const boards = useLiveQuery(() => (ready ? db.boards.toArray() : []), [ready]) || [];
  const comments = useLiveQuery(
    () => (ready && id ? db.board_comments.where('postId').equals(Number(id)).sortBy('createdAt') : []),
    [ready, id],
  ) || [];
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [commentBusy, setCommentBusy] = useState(false);

  useEffect(() => {
    if (post?.id) markPostsRead([post.id], userKey);
  }, [post?.id, userKey]);

  if (!ready || post === undefined) {
    return <div style={{ padding: 40, color: BOARD.txM }}>불러오는 중…</div>;
  }
  if (!post) {
    return (
      <div style={{ padding: 40 }}>
        <div style={{ color: BOARD.txM, marginBottom: 12 }}>게시글을 찾을 수 없습니다.</div>
        <button type="button" onClick={() => navigate('/board')} style={BOARD_BTN}>목록</button>
      </div>
    );
  }

  const mine = post.authorKey === userKey || post.authorName === accountDefaults?.displayName;
  const trashed = isBoardDeleted(post);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: BOARD.bg, minHeight: 0 }}>
      <PageHeader title="게시글" sub={boardPathLabel(boards, post.boardId) || '게시판'} />
      <div style={{ background: BOARD.surf, borderTop: `1px solid ${BOARD.bdr}`, borderBottom: `1px solid ${BOARD.bdr}`, padding: '12px 24px', display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => navigate('/board')} style={BOARD_BTN}>목록</button>
        {mine && !trashed && <button type="button" onClick={() => navigate(`/board/write?edit=${post.id}`)} style={BOARD_BTN}>수정</button>}
        {mine && !trashed && (
          <button type="button" onClick={async () => { if (window.confirm('휴지통으로 이동할까요?')) { await trashBoardPost(post.id); navigate('/board'); } }}
            style={{ ...BOARD_BTN, color: BOARD.brand }}>삭제</button>
        )}
        {trashed && (
          <>
            <button type="button" onClick={async () => { await restoreBoardPost(post.id); }} style={BOARD_BTN}>복원</button>
            <button type="button" onClick={async () => { if (window.confirm('완전히 삭제할까요?')) { await hardDeleteBoardPost(post.id); navigate('/board'); } }}
              style={{ ...BOARD_BTN, color: BOARD.brand }}>영구 삭제</button>
          </>
        )}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
        <article style={{ maxWidth: 860, margin: '0 auto', background: BOARD.surf, border: `1px solid ${BOARD.bdr}`, borderRadius: 10, padding: '28px 32px' }}>
          <div style={{ fontSize: 12, color: BOARD.txM, marginBottom: 8 }}>{boardPathLabel(boards, post.boardId)}</div>
          <h1 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {(post.isNotice || post.isMustRead) && <MustBadge />}
            {post.isImportant && <ImportantBadge />}
            {postTitleLabel(post)}
          </h1>
          <div style={{ fontSize: 13, color: BOARD.txM, display: 'flex', gap: 10, marginBottom: 20 }}>
            <span>{post.authorName}</span>
            <span>{fmtBoardDate(post.updatedAt || post.createdAt)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BoardIco.comment size={13} />{post.commentCount || 0}</span>
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.75, color: BOARD.tx }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.bodyHtml) }} />
          {Array.isArray(post.files) && post.files.length > 0 && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: `1px solid ${BOARD.bdr}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: BOARD.txM, marginBottom: 8 }}>첨부파일</div>
              {post.files.map((f, i) => {
                const canDownload = boardFileHasData(f);
                return (
                  <button
                    key={`${f.name}-${i}`}
                    type="button"
                    onClick={() => {
                      if (!downloadBoardFile(f)) window.alert('샘플 글이거나 파일 데이터가 없어 받을 수 없습니다.');
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: 32,
                      border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 13, color: canDownload ? BOARD.brand : BOARD.txS, textAlign: 'left',
                    }}
                  >
                    <BoardIco.paperclip size={13} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ color: BOARD.txP }}>{fmtBoardFileSize(f.size)}</span>
                    {canDownload ? '받기' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </article>

        <section style={{ maxWidth: 860, margin: '16px auto 0', background: BOARD.surf, border: `1px solid ${BOARD.bdr}`, borderRadius: 10, padding: '20px 24px' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: BOARD.tx, marginBottom: 14 }}>
            댓글 {comments.length}
          </div>
          {comments.length === 0 && (
            <div style={{ fontSize: 13, color: BOARD.txP, marginBottom: 14 }}>아직 댓글이 없습니다.</div>
          )}
          {groupBoardComments(comments).map(({ root, replies }) => {
            const renderComment = (c, isReply) => {
              const mineComment = c.authorKey === userKey || c.authorName === accountDefaults?.displayName;
              return (
                <div key={c.id} style={{
                  padding: isReply ? '10px 0 10px 14px' : '12px 0',
                  borderTop: isReply ? 'none' : `1px solid ${BOARD.bdr}`,
                  marginLeft: isReply ? 20 : 0,
                  borderLeft: isReply ? `2px solid ${BOARD.brandL}` : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: BOARD.tx }}>{c.authorName || '사용자'}</span>
                    <span style={{ fontSize: 12, color: BOARD.txP }}>{fmtBoardDate(c.createdAt)}</span>
                    {!trashed && (
                      <button type="button" onClick={() => { setReplyTo(c); setReplyText(''); }}
                        style={{ border: 'none', background: 'transparent', color: BOARD.brand, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                        답글
                      </button>
                    )}
                    {mineComment && !trashed && (
                      <button type="button" onClick={async () => {
                        if (!window.confirm(isReply ? '답글을 삭제할까요?' : '댓글을 삭제할까요? 답글도 함께 삭제됩니다.')) return;
                        await deleteBoardComment(c.id);
                        if (replyTo?.id === c.id) { setReplyTo(null); setReplyText(''); }
                      }}
                        style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: BOARD.txP, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>
                        삭제
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 14, color: BOARD.txS, lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.content}</div>
                  {replyTo?.id === c.id && !trashed && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                      <textarea
                        value={replyText}
                        maxLength={2000}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`${c.authorName || '작성자'}님에게 답글`}
                        style={{
                          ...BOARD_INPUT, height: 'auto', minHeight: 56, padding: '10px 12px', flex: 1, resize: 'vertical',
                          lineHeight: 1.5,
                        }}
                      />
                      <button type="button" onClick={() => { setReplyTo(null); setReplyText(''); }} style={{ ...BOARD_BTN, height: 36 }}>취소</button>
                      <button type="button" disabled={commentBusy || !replyText.trim()}
                        onClick={async () => {
                          const text = replyText.trim();
                          if (!text) return;
                          setCommentBusy(true);
                          try {
                            await addBoardComment(post.id, {
                              content: text,
                              authorName: accountDefaults?.displayName || '사용자',
                              authorKey: userKey,
                              parentId: c.id,
                            });
                            setReplyText('');
                            setReplyTo(null);
                          } catch {
                            window.alert('답글을 등록하지 못했습니다.');
                          } finally {
                            setCommentBusy(false);
                          }
                        }}
                        style={{
                          ...BOARD_BTN, background: BOARD.brand, borderColor: BOARD.brand, color: '#fff',
                          opacity: commentBusy || !replyText.trim() ? 0.5 : 1,
                        }}>
                        등록
                      </button>
                    </div>
                  )}
                </div>
              );
            };
            return (
              <div key={root.id}>
                {renderComment(root, false)}
                {replies.map((r) => renderComment(r, true))}
              </div>
            );
          })}
          {!trashed && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <textarea
                value={commentText}
                maxLength={2000}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요"
                style={{
                  ...BOARD_INPUT, height: 'auto', minHeight: 72, padding: '10px 12px', flex: 1, resize: 'vertical',
                  lineHeight: 1.5,
                }}
              />
              <button type="button" disabled={commentBusy || !commentText.trim()}
                onClick={async () => {
                  const text = commentText.trim();
                  if (!text) return;
                  setCommentBusy(true);
                  try {
                    await addBoardComment(post.id, {
                      content: text,
                      authorName: accountDefaults?.displayName || '사용자',
                      authorKey: userKey,
                    });
                    setCommentText('');
                  } catch {
                    window.alert('댓글을 등록하지 못했습니다.');
                  } finally {
                    setCommentBusy(false);
                  }
                }}
                style={{
                  ...BOARD_BTN, background: BOARD.brand, borderColor: BOARD.brand, color: '#fff',
                  opacity: commentBusy || !commentText.trim() ? 0.5 : 1,
                }}>
                등록
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
