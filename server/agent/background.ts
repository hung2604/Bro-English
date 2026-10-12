import type { H3Event } from 'h3'

type VercelContext = { waitUntil?: (promise: Promise<unknown>) => void }

/**
 * Lets work continue after the response is sent. On Vercel the function is frozen once it
 * responds unless the promise is handed to the platform's `waitUntil`; a long-lived Node
 * server just keeps running. Where neither is available, the request waits for the work.
 */
export async function runInBackground(event: H3Event, work: Promise<unknown>): Promise<void> {
  const guarded = work.catch(error => console.error('Background work failed:', error))
  const store = (globalThis as Record<symbol, unknown>)[Symbol.for('@vercel/request-context')] as
    | { get?: () => VercelContext | undefined }
    | undefined
  const vercel = store?.get?.()
  if (vercel?.waitUntil) {
    vercel.waitUntil(guarded)
    return
  }
  if (event.context.waitUntil) {
    event.waitUntil(guarded)
    return
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) await guarded
}
