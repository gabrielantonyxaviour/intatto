/**
 * The few Cloudflare Workers runtime types the keeper uses (instead of pulling @cloudflare/workers-types).
 */
declare module "cloudflare:workers" {
  export abstract class DurableObject<Env = unknown> {
    protected ctx: DurableObjectState
    protected env: Env
    constructor(ctx: DurableObjectState, env: Env)
  }
}

/** wrangler.jsonc bundles *.sql as Text modules. */
declare module "*.sql" {
  const text: string
  export default text
}

interface SqlStorageCursor {
  toArray(): Record<string, unknown>[]
}

interface DurableObjectState {
  storage: { sql: { exec(query: string, ...bindings: (string | number | null)[]): SqlStorageCursor } }
  blockConcurrencyWhile<T>(fn: () => Promise<T>): Promise<T>
}

interface DurableObjectId {
  toString(): string
}

/** RPC stub: every public method of the Durable Object, returning a promise. */
type DurableObjectStub<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : never
}

interface DurableObjectNamespace<T = unknown> {
  idFromName(name: string): DurableObjectId
  get(id: DurableObjectId): DurableObjectStub<T>
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

interface ScheduledController {
  cron: string
  scheduledTime: number
}
