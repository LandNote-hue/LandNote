/** Win(모달) 오버레이 — 뷰포트 대비 여백 */
export const WIN_OUTER_PAD = 12;

/** Win 본문 + ActionBar flex column 래퍼 */
export const WIN_COLUMN = {
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

/** Win 본문 스크롤 영역 — flex column 안에서 ActionBar와 함께 쓸 때 */
export const WIN_BODY_SCROLL = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};
