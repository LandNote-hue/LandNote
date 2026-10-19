import { db } from '../../db.js';
import { getActiveOwnerId } from '../sync/ownerScope.js';
import { BOARD_KIND, SEED_BOARDS, SEED_COMMENTS, SEED_POSTS } from '../../data/boardSeed.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LATEST_WINDOW_MS = 30 * DAY_MS;

let seedLock = null;

export function boardUserKey() {
  return getActiveOwnerId() || 'local';
}

export async function ensureBoardSeed() {
  if (seedLock) return seedLock;
  seedLock = (async () => {
    try {
      const ownerId = getActiveOwnerId();
      if ((await db.boards.count()) === 0) {
        await db.transaction('rw', [db.boards, db.board_posts, db.board_comments], async () => {
          if ((await db.boards.count()) > 0) return;
          await db.boards.bulkAdd(SEED_BOARDS.map((b) => ({ ...b, ownerId })));
          await db.board_posts.bulkAdd(SEED_POSTS.map((p) => ({
            ...p,
            ownerId,
            hasFile: !!(p.hasFile || (p.files && p.files.length)),
          })));
          await db.board_comments.bulkAdd(SEED_COMMENTS.map((c) => ({ ...c, ownerId })));
        });
      } else if (db.board_comments && (await db.board_comments.count()) === 0) {
        const seedIds = new Set(SEED_POSTS.map((p) => p.id));
        const posts = await db.board_posts.toArray();
        const existingIds = new Set(posts.filter((p) => seedIds.has(p.id)).map((p) => p.id));
        if (existingIds.size) {
          await db.board_comments.bulkAdd(SEED_COMMENTS
            .filter((c) => existingIds.has(c.postId))
            .map((c) => ({ ...c, ownerId })));
        }
      }
    } catch (err) {
      console.warn('[ensureBoardSeed]', err);
    }
  })();
  try {
    await seedLock;
  } finally {
    seedLock = null;
  }
}

export function isBoardDeleted(item) {
  return item != null && item.deletedAt != null && item.deletedAt !== '';
}

export function fmtBoardDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

export function postTitleLabel(post) {
  const prefix = String(post?.prefix || '').trim();
  const title = String(post?.title || '').trim() || '(제목 없음)';
  return prefix ? `[${prefix}] ${title}` : title;
}

export function boardPathLabel(boards, boardId) {
  const byId = new Map((boards || []).map((b) => [b.id, b]));
  const board = byId.get(Number(boardId));
  if (!board) return '';
  const parent = board.parentId != null ? byId.get(board.parentId) : null;
  return parent ? `${parent.name} · ${board.name}` : board.name;
}

export function leafBoards(boards) {
  return (boards || []).filter((b) => b.kind === BOARD_KIND.BOARD).sort((a, b) => (a.sort || 0) - (b.sort || 0));
}

export function childBoardIds(boards, folderId) {
  return (boards || []).filter((b) => b.parentId === folderId && b.kind === BOARD_KIND.BOARD).map((b) => b.id);
}

export function notifyBoardIds(boards) {
  return (boards || []).filter((b) => b.kind === BOARD_KIND.BOARD && b.notify).map((b) => b.id);
}

export function inLatestWindow(post, now = Date.now()) {
  const t = new Date(post?.updatedAt || post?.createdAt || 0).getTime();
  return Number.isFinite(t) && now - t <= LATEST_WINDOW_MS;
}

export function isUnread(post, reads, userKey = boardUserKey()) {
  if (!post?.id) return false;
  return !(reads || []).some((r) => r.postId === post.id && r.userKey === userKey);
}

export function isBoardNotice(post) {
  return !!(post?.isNotice || post?.isMustRead);
}

export function isBoardImportant(post) {
  return !!post?.isImportant && !isBoardNotice(post);
}

function pinRank(post) {
  if (isBoardNotice(post)) return 0;
  if (post?.isImportant) return 1;
  return 2;
}

function createdAtMs(post) {
  return new Date(post?.createdAt || post?.updatedAt || 0).getTime();
}

/** 공지 → 중요 → 나머지 순으로 고정 */
export function pinNoticesFirst(posts) {
  const notices = [];
  const importants = [];
  const rest = [];
  for (const p of posts || []) {
    if (isBoardNotice(p)) notices.push(p);
    else if (p?.isImportant) importants.push(p);
    else rest.push(p);
  }
  return [...notices, ...importants, ...rest];
}

/** 공지 > 중요 > 작성일 최신순 (기본) */
export function sortBoardPosts(posts, { dir = 'new', by = 'created' } = {}) {
  return [...(posts || [])].sort((a, b) => {
    const ra = pinRank(a);
    const rb = pinRank(b);
    if (ra !== rb) return ra - rb;
    if (by === 'title') return postTitleLabel(a).localeCompare(postTitleLabel(b), 'ko');
    const ta = createdAtMs(a);
    const tb = createdAtMs(b);
    return dir === 'old' ? ta - tb : tb - ta;
  });
}

function stripBoardHtml(html) {
  return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}

export function commentsByPostId(comments) {
  const map = new Map();
  for (const c of comments || []) {
    const id = Number(c.postId);
    const list = map.get(id) || [];
    list.push(c);
    map.set(id, list);
  }
  return map;
}

export function postSearchHaystack(post, boards, commentMap) {
  const board = (boards || []).find((b) => b.id === post?.boardId);
  const parent = board?.parentId != null ? (boards || []).find((b) => b.id === board.parentId) : null;
  const comments = commentMap?.get(Number(post?.id)) || [];
  const commentHay = comments.map((c) => `${c.authorName || ''} ${c.content || ''}`).join(' ');
  return [
    postTitleLabel(post),
    post?.authorName || '',
    stripBoardHtml(post?.bodyHtml),
    board?.name || '',
    parent?.name || '',
    commentHay,
  ].join(' ').toLowerCase();
}

export function filterBoardPosts(posts, { view, boardId, folderId, boards, favIds, userKey, q, comments }) {
  const notify = new Set(notifyBoardIds(boards));
  const folderKids = folderId != null ? new Set(childBoardIds(boards, folderId)) : null;
  const query = String(q || '').trim().toLowerCase();
  const commentMap = commentsByPostId(comments);
  const now = Date.now();

  let rows = (posts || []).filter((p) => {
    if (p.isDraft) return view === 'mine';
    if (view === 'trash') return isBoardDeleted(p);
    return !isBoardDeleted(p);
  });

  rows = rows.filter((p) => {
    if (view === 'trash') return true;
    if (view === 'all' || !view) return true;
    if (view === 'latest') return notify.has(p.boardId) && inLatestWindow(p, now);
    if (view === 'must' || view === 'notice') return isBoardNotice(p);
    if (view === 'important') return !!p.isImportant;
    if (view === 'mine') return p.authorKey === userKey;
    if (view === 'fav') return (favIds || []).includes(p.boardId);
    if (view === 'board') return p.boardId === Number(boardId);
    if (view === 'folder') return folderKids ? folderKids.has(p.boardId) : false;
    return true;
  });

  if (query) {
    rows = rows.filter((p) => postSearchHaystack(p, boards, commentMap).includes(query));
  }
  return sortBoardPosts(rows);
}

export async function addBoardPost(input) {
  const ownerId = getActiveOwnerId();
  const now = new Date().toISOString();
  const files = Array.isArray(input.files) ? input.files : [];
  const id = await db.board_posts.add({
    boardId: Number(input.boardId),
    prefix: String(input.prefix || ''),
    title: String(input.title || '').slice(0, 200),
    bodyHtml: String(input.bodyHtml || ''),
    authorName: String(input.authorName || '사용자'),
    authorKey: input.authorKey || boardUserKey(),
    createdAt: now,
    updatedAt: now,
    isMustRead: !!input.isMustRead,
    isNotice: !!input.isNotice,
    isImportant: !!input.isImportant,
    isDraft: !!input.isDraft,
    deletedAt: null,
    commentCount: 0,
    files,
    hasFile: files.length > 0,
    ownerId,
  });
  return id;
}

export async function updateBoardPost(id, patch) {
  const rec = await db.board_posts.get(Number(id));
  if (!rec) throw new Error('NOT_FOUND');
  const files = patch.files != null ? patch.files : rec.files;
  await db.board_posts.update(Number(id), {
    ...patch,
    files,
    hasFile: Array.isArray(files) ? files.length > 0 : !!rec.hasFile,
    updatedAt: new Date().toISOString(),
  });
}

export async function trashBoardPost(id) {
  await db.board_posts.update(Number(id), {
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function restoreBoardPost(id) {
  await db.board_posts.update(Number(id), { deletedAt: null, updatedAt: new Date().toISOString() });
}

export async function hardDeleteBoardPost(id) {
  const postId = Number(id);
  await db.transaction('rw', [db.board_posts, db.board_reads, db.board_comments], async () => {
    await db.board_reads.where('postId').equals(postId).delete();
    await db.board_comments.where('postId').equals(postId).delete();
    await db.board_posts.delete(postId);
  });
}

async function refreshPostCommentCount(postId) {
  const n = await db.board_comments.where('postId').equals(Number(postId)).count();
  await db.board_posts.update(Number(postId), { commentCount: n });
}

export async function addBoardComment(postId, { content, authorName, authorKey, parentId }) {
  const text = String(content || '').trim().slice(0, 2000);
  if (!text) throw new Error('EMPTY_COMMENT');
  let rootParent = null;
  if (parentId) {
    const parent = await db.board_comments.get(Number(parentId));
    if (parent) rootParent = parent.parentId ? Number(parent.parentId) : Number(parent.id);
  }
  const ownerId = getActiveOwnerId();
  const id = await db.board_comments.add({
    postId: Number(postId),
    parentId: rootParent,
    content: text,
    authorName: String(authorName || '사용자'),
    authorKey: authorKey || boardUserKey(),
    createdAt: new Date().toISOString(),
    ownerId,
  });
  await refreshPostCommentCount(postId);
  return id;
}

export async function deleteBoardComment(id) {
  const rec = await db.board_comments.get(Number(id));
  if (!rec) return;
  await db.transaction('rw', db.board_comments, async () => {
    await db.board_comments.where('parentId').equals(Number(id)).delete();
    await db.board_comments.delete(Number(id));
  });
  await refreshPostCommentCount(rec.postId);
}

export function groupBoardComments(comments) {
  const rows = [...(comments || [])].sort((a, b) => {
    const ta = new Date(a.createdAt || 0).getTime();
    const tb = new Date(b.createdAt || 0).getTime();
    return ta - tb;
  });
  const roots = rows.filter((c) => c.parentId == null);
  const byParent = new Map();
  for (const c of rows) {
    if (c.parentId == null) continue;
    const list = byParent.get(Number(c.parentId)) || [];
    list.push(c);
    byParent.set(Number(c.parentId), list);
  }
  return roots.map((root) => ({ root, replies: byParent.get(root.id) || [] }));
}

export async function markPostsRead(postIds, userKey = boardUserKey()) {
  const ids = [...new Set((postIds || []).map(Number).filter(Boolean))];
  const now = new Date().toISOString();
  await db.transaction('rw', db.board_reads, async () => {
    for (const postId of ids) {
      await db.board_reads.put({ postId, userKey, readAt: now });
    }
  });
}

export async function toggleBoardFav(boardId, userKey = boardUserKey()) {
  const key = [Number(boardId), userKey];
  const existing = await db.board_favs.get(key);
  if (existing) {
    await db.board_favs.delete(key);
    return false;
  }
  await db.board_favs.put({ boardId: Number(boardId), userKey });
  return true;
}

export async function setBoardNotify(boardId, notify) {
  await db.boards.update(Number(boardId), { notify: !!notify });
}

function sameParent(a, b) {
  return (a ?? null) === (b ?? null);
}

export function normalizeBoardPrefixes(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const s = String(raw || '').trim().slice(0, 20);
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

async function nextBoardSort(parentId, kind) {
  const parent = parentId == null || parentId === '' ? null : Number(parentId);
  const rows = await db.boards.toArray();
  const sibs = rows.filter((b) => b.kind === kind && sameParent(b.parentId, parent));
  return sibs.reduce((m, b) => Math.max(m, Number(b.sort) || 0), 0) + 1;
}

export async function createBoardFolder(name) {
  const trimmed = String(name || '').trim().slice(0, 40);
  if (!trimmed) throw new Error('EMPTY_NAME');
  const ownerId = getActiveOwnerId();
  return db.boards.add({
    parentId: null,
    kind: BOARD_KIND.FOLDER,
    slug: `folder-${Date.now()}`,
    name: trimmed,
    notify: false,
    sort: await nextBoardSort(null, BOARD_KIND.FOLDER),
    ownerId,
  });
}

export async function createBoard(name, parentId, prefixes = []) {
  const trimmed = String(name || '').trim().slice(0, 40);
  if (!trimmed) throw new Error('EMPTY_NAME');
  const parent = parentId == null || parentId === '' ? null : Number(parentId);
  if (parent != null) {
    const folder = await db.boards.get(parent);
    if (!folder || folder.kind !== BOARD_KIND.FOLDER) throw new Error('INVALID_PARENT');
  }
  const ownerId = getActiveOwnerId();
  return db.boards.add({
    parentId: parent,
    kind: BOARD_KIND.BOARD,
    slug: `board-${Date.now()}`,
    name: trimmed,
    notify: true,
    sort: await nextBoardSort(parent, BOARD_KIND.BOARD),
    prefixes: normalizeBoardPrefixes(prefixes),
    ownerId,
  });
}

export async function updateBoardNode(id, patch) {
  const rec = await db.boards.get(Number(id));
  if (!rec) throw new Error('NOT_FOUND');
  /** @type {Record<string, unknown>} */
  const next = {};
  if (patch.name != null) {
    const name = String(patch.name).trim().slice(0, 40);
    if (!name) throw new Error('EMPTY_NAME');
    next.name = name;
  }
  if (patch.notify != null) next.notify = !!patch.notify;
  if (rec.kind === BOARD_KIND.BOARD && patch.prefixes != null) {
    next.prefixes = normalizeBoardPrefixes(patch.prefixes);
  }
  if (rec.kind === BOARD_KIND.BOARD && patch.parentId !== undefined) {
    const parent = patch.parentId == null || patch.parentId === '' ? null : Number(patch.parentId);
    if (parent != null) {
      const folder = await db.boards.get(parent);
      if (!folder || folder.kind !== BOARD_KIND.FOLDER) throw new Error('INVALID_PARENT');
    }
    if (!sameParent(rec.parentId, parent)) {
      next.parentId = parent;
      next.sort = await nextBoardSort(parent, BOARD_KIND.BOARD);
    }
  }
  if (Object.keys(next).length) await db.boards.update(rec.id, next);
}

export async function renameBoardPrefix(boardId, from, to) {
  const rec = await db.boards.get(Number(boardId));
  if (!rec || rec.kind !== BOARD_KIND.BOARD) throw new Error('NOT_FOUND');
  const nextName = String(to || '').trim().slice(0, 20);
  if (!nextName) throw new Error('EMPTY_NAME');
  const prefixes = normalizeBoardPrefixes(prefixesOf(rec).map((p) => (p === from ? nextName : p)));
  await db.boards.update(rec.id, { prefixes });
  if (from && from !== nextName) {
    const posts = await db.board_posts.where('boardId').equals(rec.id).toArray();
    await Promise.all(posts.filter((p) => p.prefix === from).map((p) => db.board_posts.update(p.id, { prefix: nextName })));
  }
}

export async function reorderBoardNode(id, dir) {
  const rec = await db.boards.get(Number(id));
  if (!rec) return;
  const rows = await db.boards.toArray();
  const sibs = rows
    .filter((b) => b.kind === rec.kind && sameParent(b.parentId, rec.parentId))
    .sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id);
  const i = sibs.findIndex((b) => b.id === rec.id);
  const j = i + (dir < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= sibs.length) return;
  const next = [...sibs];
  const [moved] = next.splice(i, 1);
  next.splice(j, 0, moved);
  await db.transaction('rw', db.boards, async () => {
    await Promise.all(next.map((b, idx) => db.boards.update(b.id, { sort: idx + 1 })));
  });
}

export async function deleteBoardNode(id) {
  const rec = await db.boards.get(Number(id));
  if (!rec) return;
  const now = new Date().toISOString();
  const all = await db.boards.toArray();
  const boardIds = rec.kind === BOARD_KIND.FOLDER
    ? all.filter((b) => b.kind === BOARD_KIND.BOARD && b.parentId === rec.id).map((b) => b.id)
    : [rec.id];
  const removeIds = rec.kind === BOARD_KIND.FOLDER ? [...boardIds, rec.id] : boardIds;

  await db.transaction('rw', [db.boards, db.board_posts, db.board_favs], async () => {
    for (const bid of boardIds) {
      const posts = await db.board_posts.where('boardId').equals(bid).toArray();
      await Promise.all(posts.filter((p) => !p.deletedAt).map((p) => db.board_posts.update(p.id, { deletedAt: now, updatedAt: now })));
      await db.board_favs.where('boardId').equals(bid).delete();
    }
    await Promise.all(removeIds.map((bid) => db.boards.delete(bid)));
  });
}

export function prefixesOf(board) {
  return Array.isArray(board?.prefixes) ? board.prefixes : [];
}

export const BOARD_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const BOARD_FILE_MAX_COUNT = 10;

export function fmtBoardFileSize(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${Math.max(0.1, v / 1024).toFixed(1)} KB`;
  return `${(v / (1024 * 1024)).toFixed(1)} MB`;
}

export function boardFileHasData(file) {
  const data = file?.data ?? file?.blob;
  if (!data) return false;
  if (data instanceof Blob) return data.size > 0;
  if (data instanceof ArrayBuffer) return data.byteLength > 0;
  return false;
}

export async function boardFileFromInput(file) {
  if (!file) throw new Error('NO_FILE');
  if (file.size > BOARD_FILE_MAX_BYTES) throw new Error(`FILE_TOO_LARGE:${file.name}`);
  const data = await file.arrayBuffer();
  return {
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    data,
  };
}

export function downloadBoardFile(file) {
  if (!boardFileHasData(file)) return false;
  const raw = file.data ?? file.blob;
  const blob = raw instanceof Blob ? raw : new Blob([raw], { type: file.type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name || '첨부파일';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

export function isBoardInlineImage(file) {
  return String(file?.type || '').startsWith('image/');
}

export function isBoardVideoFile(file) {
  const name = String(file?.name || '').toLowerCase();
  const type = String(file?.type || '');
  return type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov');
}
