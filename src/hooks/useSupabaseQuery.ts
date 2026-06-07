import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'idle' | 'loading' | 'error' | 'success'

interface UseSupabaseQueryResult<T> {
  data: T | null
  status: Status
  loading: boolean
  error: string | null
  refresh: () => void
}

/**
 * Supabase sorguları için standart hook.
 * - Auto-fetch on mount (eğer immediate === true, varsayılan)
 * - loading / error / data state yönetimi
 * - refresh() ile yeniden sorgulama
 *
 * @example
 * const { data: athletes, loading, error, refresh } = useSupabaseQuery(
 *   () => supabase.from('athletes').select('*').eq('is_active', true),
 * )
 */
export function useSupabaseQuery<T>(
  fetcher: () => Promise<{ data: T | null; error: any }>,
  deps: unknown[] = [],
  immediate = true,
): UseSupabaseQueryResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const execute = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const { data: result, error: err } = await fetcher()
      if (!mountedRef.current) return
      if (err) {
        setError(err?.message ?? 'Beklenmeyen hata')
        setStatus('error')
      } else {
        setData(result)
        setStatus('success')
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Beklenmeyen hata')
      setStatus('error')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    mountedRef.current = true
    if (immediate) void execute()
    return () => { mountedRef.current = false }
  }, [execute, immediate])

  return { data, status, loading: status === 'loading', error, refresh: execute }
}

/**
 * CRUD operasyonları için yardımcı hook.
 * create / update / delete işlemlerinde saving state + error handling standardizasyonu.
 */
export function useCrud() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const execute = useCallback(async <T>(
    operation: () => Promise<{ error: any }>,
    successMsg?: string,
  ): Promise<T | null> => {
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const { error: err } = await operation()
      if (err) {
        setError(err?.message ?? 'İşlem başarısız.')
        return null
      }
      if (successMsg) setMessage(successMsg)
      return {} as T
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız.')
      return null
    } finally {
      setSaving(false)
    }
  }, [])

  const clearMessages = useCallback(() => {
    setError(null)
    setMessage(null)
  }, [])

  return { saving, error, message, setError, setMessage, execute, clearMessages }
}
