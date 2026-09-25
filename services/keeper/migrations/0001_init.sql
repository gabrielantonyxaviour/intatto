-- Keeper schema, applied by the KeeperState Durable Object (SQLite storage) on start. Idempotent.

-- One row per keeper action, newest last. detail is a sentence; data is JSON; tx_hash is set for sent txs.
CREATE TABLE IF NOT EXISTS keeper_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  market TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('session', 'price', 'price-rejected', 'cap', 'action', 'liquidation', 'backoff', 'skipped')),
  detail TEXT NOT NULL,
  data TEXT,
  tx_hash TEXT
);

CREATE INDEX IF NOT EXISTS keeper_actions_market_kind ON keeper_actions (market, kind, id);

-- Cursors and last-post memory: cursor:<SYM>, borrowers:<SYM>, cap:<SYM>, action:<SYM>, lock, last_cycle.
CREATE TABLE IF NOT EXISTS keeper_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
