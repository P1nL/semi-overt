/** Missing/invalid storage is not an explicit light preference. */
export function resolveDarkPreference(raw: string | null, systemDark: boolean): boolean {
  if (raw === 'true') return true
  if (raw === 'false') return false
  return systemDark
}
