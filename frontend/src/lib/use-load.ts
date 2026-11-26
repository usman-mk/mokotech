import { useEffect, useEffectEvent, useState } from 'react'
import { ApiError } from './api'

type Result<T> = { key: string; data?: T; error?: string }

/**
 * Runs `load` whenever `key` changes (e.g. `${userId}:${refreshKey}`).
 * The result remembers which key it belongs to, so while a new key is loading
 * the old data is not shown (no other user's rows after switching user), and
 * a late response for an old key is ignored.
 */
export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [result, setResult] = useState<Result<T> | null>(null)
  const run = useEffectEvent(load)

  useEffect(() => {
    let current = true
    run()
      .then((data) => current && setResult({ key, data }))
      .catch((e: unknown) => {
        const error = e instanceof ApiError ? e.message : String(e)
        if (current) setResult({ key, error })
      })
    return () => {
      current = false
    }
  }, [key])

  const fresh = result?.key === key ? result : null
  return { data: fresh?.data ?? null, error: fresh?.error ?? null }
}
