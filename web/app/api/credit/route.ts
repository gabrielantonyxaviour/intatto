/** GET /api/credit?wallet=0x…&market=NVDAx[&network=mainnet|sandbox][&session=<id>] — see okx-ai/README.md. */
import { handleCredit, serviceDescription } from "../../../lib/credit/handler"

export async function GET(req: Request): Promise<Response> {
  return handleCredit(req)
}

/** A bare POST (OKX AI's A2MCP reachability check) gets the free service description. */
export async function POST(req: Request): Promise<Response> {
  return serviceDescription(req)
}
