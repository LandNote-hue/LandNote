/** @type {File | null} */
let pendingFile = null;

/** @param {File} file */
export function setPendingBulkFile(file) {
  pendingFile = file;
}

/** @returns {File | null} */
export function consumePendingBulkFile() {
  const file = pendingFile;
  pendingFile = null;
  return file;
}
