import { liveDeployment } from "@/lib/chain/deployment"

/** Liveness for the public app: answers without touching the chain. */
export function GET() {
  return Response.json({
    ok: true,
    service: "intatto-web",
    network: "xlayer",
    deployed: Boolean(liveDeployment),
    sandboxApi: process.env.NEXT_PUBLIC_SANDBOX_API_URL ?? null,
    time: new Date().toISOString(),
  })
}
