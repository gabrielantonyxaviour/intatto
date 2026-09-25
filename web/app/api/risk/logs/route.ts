/** GET /api/risk/logs?network=mainnet&from=<block>&to=<block> — cached raw Intatto logs for one ≤100-block chunk. */
import { handleRiskLogs } from "@/lib/risk-logs/server"

export async function GET(req: Request): Promise<Response> {
  return handleRiskLogs(req)
}
