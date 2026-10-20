import { ApiError } from './api-error.ts'

export async function requestJson<T>(url: string, options: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, timeoutController.signal]) : timeoutController.signal,
      headers: { Accept: 'application/json', ...options.headers },
    })
    if (!response.ok) {
      let body: unknown
      try { body = await response.json() } catch { /* HTTP fallback for non-JSON responses. */ }
      throw new ApiError(response.status, response.statusText, body)
    }
    return response.status === 204 ? {} as T : await response.json()
  } catch (cause) {
    const error = timeoutController.signal.aborted
      ? new Error(`Backend không phản hồi sau ${timeoutMs / 1000} giây (${options.method ?? 'GET'} ${url}). Kiểm tra terminal backend và thử lại.`)
      : cause instanceof TypeError
      ? new Error(`Không kết nối được backend (${options.method ?? 'GET'} ${url}). Kiểm tra backend đang chạy và thử lại.`, { cause })
      : cause
    console.error(`[API] ${options.method ?? 'GET'} ${url}`, error)
    throw error
  } finally {
    clearTimeout(timer)
  }
}
