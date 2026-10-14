import proof from "../../motion/data/proof.json";

/** The four rows beat 08 shows, from proof.json (mainnet pinned to the fork block vs the live sandbox). */
export type ProofRow = { id: string; label: string; mainnet: string; sandbox: string; equal: boolean };

const pick = (id: string, label: string): ProofRow => {
  const r = proof.rows.find((row) => row.id === id);
  if (!r) throw new Error(`proof.json has no row ${id}`);
  return { id, label, mainnet: r.mainnet.value, sandbox: r.sandbox.value, equal: r.equal && r.mainnet.value === r.sandbox.value };
};

/** In the order the line says them: same block, same code, same state. */
export const PROOF_ROWS: ProofRow[] = [
  pick("fork-block", `Block ${proof.forkBlock.toLocaleString("en-US")} · hash`),
  pick("NVDAx", "NVDAx · bytecode keccak"),
  pick("CollateralMarket", "CollateralMarket · bytecode keccak"),
  pick("usdg-supply", "USDG · totalSupply (raw units)"),
];

/** "25 Sep 2026 14:41 UTC" from the snapshot's retrievedAt. */
export const SNAPSHOT = (() => {
  const d = new Date(proof.retrievedAt);
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${mon} ${d.getUTCFullYear()} ${hh}:${mm} UTC`;
})();
export const FORK_BLOCK = proof.forkBlock;
