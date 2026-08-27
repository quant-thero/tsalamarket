/* ==========================================================================
   Tsala Market -- Client-side data store
   Simulates a backend using localStorage so the demo persists submissions,
   admin actions and configuration across pages/reloads. Frontend-only build:
   there is no server here -- this is a stand-in for the eventual API layer.
   ========================================================================== */

const STORE_KEYS = {
  entries: "tsala_price_entries",
  auditLog: "tsala_audit_log",
  queryLog: "tsala_query_log",
  systemParams: "tsala_system_params",
  seeded: "tsala_seeded_v1",
};

const Store = {
  init() {
    if (!localStorage.getItem(STORE_KEYS.seeded)) {
      localStorage.setItem(STORE_KEYS.entries, JSON.stringify(SEED_ENTRIES));
      localStorage.setItem(STORE_KEYS.auditLog, JSON.stringify([]));
      localStorage.setItem(STORE_KEYS.queryLog, JSON.stringify(typeof SEED_QUERY_LOG !== "undefined" ? SEED_QUERY_LOG : []));
      localStorage.setItem(STORE_KEYS.systemParams, JSON.stringify(DEFAULT_SYSTEM_PARAMS));
      localStorage.setItem(STORE_KEYS.seeded, "1");
    }
  },

  reset() {
    localStorage.removeItem(STORE_KEYS.seeded);
    this.init();
  },

  getEntries() { return JSON.parse(localStorage.getItem(STORE_KEYS.entries) || "[]"); },
  saveEntries(list) { localStorage.setItem(STORE_KEYS.entries, JSON.stringify(list)); },

  addEntry(e) {
    const list = this.getEntries();
    list.push(e);
    this.saveEntries(list);
    return e;
  },

  updateEntry(id, patch) {
    const list = this.getEntries();
    const idx = list.findIndex(x => x.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patch };
    this.saveEntries(list);
    return list[idx];
  },

  getAuditLog() { return JSON.parse(localStorage.getItem(STORE_KEYS.auditLog) || "[]"); },
  addAuditRecord(rec) {
    const log = this.getAuditLog();
    log.unshift({ ...rec, timestamp: new Date().toISOString() });
    localStorage.setItem(STORE_KEYS.auditLog, JSON.stringify(log));
  },

  getQueryLog() { return JSON.parse(localStorage.getItem(STORE_KEYS.queryLog) || "[]"); },
  addQueryLogRecord(rec) {
    const log = this.getQueryLog();
    log.unshift({ ...rec, timestamp: new Date().toISOString() });
    localStorage.setItem(STORE_KEYS.queryLog, JSON.stringify(log));
  },

  getSystemParams() { return JSON.parse(localStorage.getItem(STORE_KEYS.systemParams) || "{}"); },
  saveSystemParams(p) { localStorage.setItem(STORE_KEYS.systemParams, JSON.stringify(p)); },
};

Store.init();
