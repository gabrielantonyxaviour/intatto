/** Unknown API paths answer JSON like every other API error, never the HTML 404 page. */
function notFound(req: Request): Response {
  const path = (() => {
    try {
      return new URL(req.url).pathname
    } catch {
      return "/api"
    }
  })()
  return Response.json({ error: `No API at ${path}. The credit API is /api/credit.`, code: "NOT_FOUND" }, { status: 404 })
}

export const GET = notFound
export const POST = notFound
export const PUT = notFound
export const PATCH = notFound
export const DELETE = notFound
