-- Credit API call receipts, applied by KeeperState the same way as 0001. Idempotent.
-- header_names is a JSON array of header names only. ua is the User-Agent, already truncated by the sender.

CREATE TABLE IF NOT EXISTS credit_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('okx-ai', 'direct')),
  wallet TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('NVDAx', 'SPYx')),
  network TEXT NOT NULL CHECK (network IN ('mainnet', 'sandbox')),
  status INTEGER NOT NULL,
  header_names TEXT NOT NULL,
  ua TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS credit_receipts_source_id ON credit_receipts (source, id);
