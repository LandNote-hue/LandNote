import { processBulkPropertyRow } from '../lib/bulkPropertyRowProcessor.js';

export const BULK_IMPORT_PATH = '/api/properties/bulk-import';

/**
 * @param {Record<string, string>} env
 */
export function createPropertyBulkImportHandler(env) {
  return async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      res.status(400).json({ message: 'rows 배열이 필요합니다.' });
      return;
    }
    if (rows.length > 30) {
      res.status(400).json({ message: '청크당 최대 30건까지 처리 가능합니다.' });
      return;
    }

    /** @type {Array<{ rowIndex: number, success: boolean, error?: string, property?: object }>} */
    const results = [];

    for (const row of rows) {
      const rowIndex = Number(row.rowIndex) || 0;
      try {
        const property = await processBulkPropertyRow(row, env);
        results.push({
          rowIndex,
          success: true,
          property,
          reportKey: row.reportKey || '',
        });
      } catch (err) {
        results.push({
          rowIndex,
          success: false,
          error: err?.message || '처리 실패',
        });
      }
    }

    res.json({ results });
  };
}
