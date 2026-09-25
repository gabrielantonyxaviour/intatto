/** GET /api/credit/receipts?source=okx-ai|direct[&limit=] — public counts from the keeper. */
import { handleReceipts } from "../../../../lib/credit/receipts"

export async function GET(req: Request): Promise<Response> {
  return handleReceipts(req)
}
