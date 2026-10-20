const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object'

export class ApiError extends Error {
  status: number
  code?: string
  details: unknown

  constructor(status: number, statusText: string, body: unknown) {
    const payload = isRecord(body) && isRecord(body.error) ? body.error : undefined
    const message = typeof payload?.message === 'string' ? payload.message : `HTTP error ${status}: ${statusText}`
    const details = payload?.details
    const fields = Array.isArray(details) ? details.flatMap(detail => {
      if (!isRecord(detail) || typeof detail.message !== 'string') return []
      return [typeof detail.field === 'string' && detail.field ? `${detail.field}: ${detail.message}` : detail.message]
    }) : []
    super([message, ...fields].join('\n'))
    this.name = 'ApiError'
    this.status = status
    this.code = typeof payload?.code === 'string' ? payload.code : undefined
    this.details = details
  }
}
