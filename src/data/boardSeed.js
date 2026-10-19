export const BOARD_KIND = {
  FOLDER: 'folder',
  BOARD: 'board',
};

export const SEED_BOARDS = [
  { id: 1, parentId: null, kind: BOARD_KIND.FOLDER, slug: 'yeongeondong', name: '연건동 진행', notify: true, sort: 1 },
  { id: 2, parentId: 1, kind: BOARD_KIND.BOARD, slug: 'landlord', name: '지주정보', notify: true, sort: 1, prefixes: ['지주정보'] },
  { id: 3, parentId: 1, kind: BOARD_KIND.BOARD, slug: 'files', name: '자료게시판', notify: true, sort: 2, prefixes: ['연건동', '업무'] },
  { id: 4, parentId: 1, kind: BOARD_KIND.BOARD, slug: 'free', name: '자유게시판', notify: true, sort: 3, prefixes: [] },
];

const P = (partial) => ({
  authorName: '이도근',
  authorKey: 'seed-idogun',
  commentCount: 1,
  isMustRead: false,
  isNotice: false,
  isImportant: false,
  isDraft: false,
  deletedAt: null,
  files: [],
  bodyHtml: '',
  ...partial,
});

function bodyOf(title) {
  return `<p>${title}</p><p>관련 내용을 공유합니다. 확인 부탁드립니다.</p>`;
}

export const SEED_POSTS = [
  P({
    id: 1, boardId: 3, prefix: '연건동',
    title: '지주작업 실행패키지 공유 및 진행 안내의 건',
    isMustRead: true, isNotice: true,
    hasFile: true, files: [{ name: '실행패키지.pdf', size: 240000 }],
    createdAt: '2026-09-28T09:00:00.000Z', updatedAt: '2026-09-28T09:00:00.000Z',
    bodyHtml: bodyOf('지주작업 실행패키지 공유 및 진행 안내의 건'),
  }),
  P({
    id: 2, boardId: 2, prefix: '지주정보',
    title: '연건동 193-4 외 4필지 청량,신라, 홍동국님 누님 홍지연님',
    isImportant: true,
    createdAt: '2026-10-15T10:00:00.000Z', updatedAt: '2026-10-15T10:00:00.000Z',
    bodyHtml: bodyOf('연건동 193-4 외 4필지 청량,신라, 홍동국님 누님 홍지연님'),
  }),
  P({
    id: 3, boardId: 2, prefix: '지주정보',
    title: '연건동 190-22 오양빌딩 아드님 최승구님',
    createdAt: '2026-10-15T09:30:00.000Z', updatedAt: '2026-10-15T09:30:00.000Z',
    bodyHtml: bodyOf('연건동 190-22 오양빌딩 아드님 최승구님'),
  }),
  P({
    id: 4, boardId: 2, prefix: '지주정보',
    title: '연건동 192-1 김정렬님',
    createdAt: '2026-10-01T11:00:00.000Z', updatedAt: '2026-10-01T11:00:00.000Z',
    bodyHtml: bodyOf('연건동 192-1 김정렬님'),
  }),
  P({
    id: 5, boardId: 2, prefix: '지주정보',
    title: '연건동 190-29 김건호님',
    createdAt: '2026-09-30T11:00:00.000Z', updatedAt: '2026-09-30T11:00:00.000Z',
    bodyHtml: bodyOf('연건동 190-29 김건호님'),
  }),
  P({
    id: 6, boardId: 3, prefix: '',
    title: '지주 대상 DM 송부 파일(원본) 및 리스트',
    hasFile: true, files: [{ name: 'DM원본.zip', size: 1200000 }],
    createdAt: '2026-09-28T08:40:00.000Z', updatedAt: '2026-09-28T08:40:00.000Z',
    bodyHtml: bodyOf('지주 대상 DM 송부 파일(원본) 및 리스트'),
  }),
  P({
    id: 7, boardId: 3, prefix: '',
    title: '연건동 지주 대상 DM 샘플 송부의 건_검토의견 및 수정문안 공유의 건',
    hasFile: true, files: [{ name: 'DM샘플.docx', size: 86000 }],
    createdAt: '2026-09-28T08:20:00.000Z', updatedAt: '2026-09-28T08:20:00.000Z',
    bodyHtml: bodyOf('연건동 지주 대상 DM 샘플 송부의 건_검토의견 및 수정문안 공유의 건'),
  }),
  P({
    id: 8, boardId: 3, prefix: '업무',
    title: '연건동 호텔관련 추가자료 송부의 건',
    hasFile: true, files: [{ name: '호텔자료.pdf', size: 540000 }],
    createdAt: '2026-09-28T08:00:00.000Z', updatedAt: '2026-09-28T08:00:00.000Z',
    bodyHtml: bodyOf('연건동 호텔관련 추가자료 송부의 건'),
  }),
];

export const SEED_COMMENTS = SEED_POSTS.map((p, i) => ({
  id: i + 1,
  postId: p.id,
  authorName: '이도근',
  authorKey: 'seed-idogun',
  content: '확인했습니다.',
  createdAt: p.createdAt,
}));
