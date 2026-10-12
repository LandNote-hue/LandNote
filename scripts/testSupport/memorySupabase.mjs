/**
 * 운영 데이터와 분리된 메모리 Supabase 흉내 (PostgREST 체인 최소 구현)
 */
export function createMemorySupabase(options = {}) {
  const tables = {
    properties: new Map(),
    rentals: new Map(),
  };
  let seq = 1000;
  const delayMs = options.updateDelayMs || 0;
  let updateGate = options.updateGate || null;
  let deleteGate = options.deleteGate || null;

  function rowsOf(name) {
    return [...tables[name].values()];
  }

  function match(row, filters) {
    return filters.every(([k, v]) => String(row[k]) === String(v));
  }

  function makeResult(data, error = null, count = null) {
    return { data, error, count, status: error ? 400 : 200 };
  }

  class Query {
    constructor(table, action, payload) {
      this.table = table;
      this.action = action;
      this.payload = payload;
      this.filters = [];
      this._headCount = false;
    }

    select(_cols, opts = {}) {
      if (opts.head && opts.count === 'exact') this._headCount = true;
      return this;
    }

    eq(key, value) {
      this.filters.push([key, value]);
      return this;
    }

    order() { return this; }

    range() { return this; }

    async maybeSingle() {
      return this._run('maybe');
    }

    async single() {
      const res = await this._run('single');
      if (!res.error && (res.data == null)) {
        return { data: null, error: { message: 'not found', code: 'PGRST116' } };
      }
      return res;
    }

    then(resolve, reject) {
      return this._run('list').then(resolve, reject);
    }

    async _run(mode) {
      const store = tables[this.table];
      if (!store) return makeResult(null, { message: 'unknown table' });

      if (this.action === 'insert') {
        const row = { ...this.payload };
        const dup = rowsOf(this.table).find((r) => String(r.user_id) === String(row.user_id)
          && String(r.local_id) === String(row.local_id)
          && row.local_id != null);
        if (dup) {
          return makeResult(null, { code: '23505', message: 'duplicate key' });
        }
        if (row.id == null) row.id = seq++;
        row.updated_at = row.updated_at || new Date().toISOString();
        row.created_at = row.created_at || row.updated_at;
        store.set(String(row.id), row);
        return makeResult({ id: row.id, updated_at: row.updated_at, created_at: row.created_at });
      }

      if (this.action === 'update') {
        if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
        if (typeof updateGate === 'function') await updateGate();
        const hits = rowsOf(this.table).filter((r) => match(r, this.filters));
        if (hits.length !== 1) {
          if (mode === 'list') return makeResult([]);
          return makeResult(null);
        }
        const prev = hits[0];
        const next = {
          ...prev,
          ...this.payload,
          id: prev.id,
          updated_at: new Date().toISOString(),
        };
        store.set(String(prev.id), next);
        return makeResult({ id: next.id, updated_at: next.updated_at });
      }

      if (this.action === 'delete') {
        if (typeof deleteGate === 'function') await deleteGate();
        const hits = rowsOf(this.table).filter((r) => match(r, this.filters));
        if (hits.length !== 1) return makeResult(null);
        store.delete(String(hits[0].id));
        return makeResult({ id: hits[0].id });
      }

      // select
      let list = rowsOf(this.table).filter((r) => match(r, this.filters));
      if (this._headCount) return { data: null, error: null, count: rowsOf(this.table).length };
      if (mode === 'maybe' || mode === 'single') return makeResult(list[0] || null);
      return makeResult(list);
    }
  }

  return {
    tables,
    from(table) {
      const start = {
        insert: (row) => new Query(table, 'insert', row),
        update: (row) => new Query(table, 'update', row),
        delete: () => new Query(table, 'delete', null),
        select: (cols, opts) => {
          const q = new Query(table, 'select', null);
          return q.select(cols, opts);
        },
      };
      return start;
    },
    seed(table, row) {
      const r = {
        ...row,
        updated_at: row.updated_at || '2026-01-01T00:00:00.000Z',
        created_at: row.created_at || row.updated_at || '2026-01-01T00:00:00.000Z',
      };
      tables[table].set(String(r.id), r);
      return r;
    },
    get(table, id) {
      return tables[table].get(String(id));
    },
    count(table) {
      return tables[table].size;
    },
    setUpdateGate(fn) {
      updateGate = fn;
    },
    setDeleteGate(fn) {
      deleteGate = fn;
    },
  };
}
