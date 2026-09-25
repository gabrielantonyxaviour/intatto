/** GET /api/credit/health[?network=mainnet|sandbox][&session=<id>] → { ok, network, block }. Always free. */
import { handleHealth } from "../../../../lib/credit/handler"

export async function GET(req: Request): Promise<Response> {
  return handleHealth(req)
}
