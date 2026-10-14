import credit from "../../motion/data/credit.json";
import service from "../../../../../okx-ai/credit-service.json";
import { cueFrame } from "../ui/Caption";
import { beat } from "../script";
import { beatFrames } from "../stage";

/**
 * Beat 10's own palette: the OKX AI moment steps out of the film's black and white. The violet is sampled from
 * OKX AI's app icon (okx.ai apple-touch-icon, #6C43FD); the ground is a deep indigo lit by slow violet and blue
 * light, like okx.ai itself. Glass surfaces carry the chat.
 */
export const AI = {
  violet: "#6C43FD",
  violetHi: "#8A6BFF",
  ground: "#07061A",
  blue: "#2F4BFF",
  rose: "#C86BFF",
  ink: "#FFFFFF",
  soft: "rgba(255,255,255,0.64)",
  faint: "rgba(255,255,255,0.42)",
  glass: "rgba(255,255,255,0.075)",
  glassHi: "rgba(255,255,255,0.11)",
  edge: "rgba(255,255,255,0.14)",
  check: "#5BE3A4",
} as const;

const p = credit.payload;

/** Real values only: credit.json (GET /api/credit, X Layer block 71,578,040) and okx-ai/credit-service.json. */
export const DATA = {
  agentId: service.agentId, // "13907"
  serviceName: service.serviceName, // "Borrow capacity and health"
  serviceType: service.service_type, // "A2MCP"
  regTx: `${service.registrationTx.slice(0, 10)}…${service.registrationTx.slice(-6)}`,
  wallet: "0x7F23…a415",
  request: "GET /api/credit?market=NVDAx&wallet=0x7F23…a415",
  borrowable: p.capacity.borrowableNowUsdg, // "0.146001"
  session: p.session.state, // "OPEN"
  limitPct: p.capacity.limitBps / 100, // 50
  ltv: (p.position.ltvBps / 100).toFixed(2), // "36.63"
  liquidation: Number(p.liquidation.liquidationPriceUsd).toFixed(2), // "126.16"
  block: p.block.toLocaleString("en-US"), // "71,578,040"
};

const B = beat(10);
export const DURATION = beatFrames(10);
const cue = (phrase: string) => cueFrame(B.vo, DURATION, phrase);

/** Frame `b`, but never before `a + gap`: keeps ranges increasing however fast Gabriel says the words. */
export const after = (a: number, b: number, gap = 2) => Math.max(b, a + gap);

/**
 * Every entrance hangs off one of Gabriel's words (whisper timing via cueFrame), and each moment also waits for the
 * one before it to finish, so fast speech compresses the scene without ever reversing it.
 */
const dive = Math.max(34, cue("OKX AI") - 14);
const cardIn = dive + 44;
const idAt = cardIn + 16;
const serviceAt = after(idAt + 6, cue("A2MCP") + 4);
const reviewAt = after(serviceAt + 14, cue("Borrow capacity") + 18);
const dockAt = after(reviewAt + 20, cue("so anyone") - 4);
const typeFrom = dockAt + 16;
const sendAt = after(typeFrom + 32, cue("ask how much") + 8);
const thinkAt = sendAt + 14;
const callAt = after(thinkAt + 14, cue("It reads straight") - 8);
const okAt = after(callAt + 40, cue("works out the numbers") + 12);
const answerAt = after(okAt + 10, cue("and responds") - 6);
const r0 = after(answerAt + 22, cue("the session"));
const r1 = after(r0 + 12, cue("the limit"));
const r2 = after(r1 + 12, cue("the LTV"));
const r3 = after(r2 + 12, cue("the liquidation price"));

export const T = {
  iconIn: 2,
  dive,
  cardIn,
  idAt,
  serviceAt,
  reviewAt,
  dockAt,
  typeFrom,
  sendAt,
  thinkAt,
  callAt,
  okAt,
  answerAt,
  rows: [r0, r1, r2, r3],
} as const;
