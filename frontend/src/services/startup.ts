// Apply each response as it arrives; a slow hardware probe must not hide controls.
export async function loadStartupResources(tasks: Record<string, () => Promise<void>>): Promise<string[]> {
  const results = await Promise.all(Object.entries(tasks).map(async ([label, load]) => {
    try {
      await load()
      return null
    } catch (error) {
      console.error(`[Startup] ${label}`, error)
      return `${label}: ${error instanceof Error ? error.message : String(error)}`
    }
  }))
  return results.filter((error): error is string => error !== null)
}
