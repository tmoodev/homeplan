type SyncState = 'idle' | 'saving' | 'saved' | 'error'

export default function SyncIndicator({ state }: { state: SyncState }) {
  if (state === 'idle') return null

  const map: Record<Exclude<SyncState, 'idle'>, { cls: string; label: string }> = {
    saving: { cls: 'sync-saving', label: '● Saving…' },
    saved:  { cls: 'sync-saved',  label: '✓ Saved' },
    error:  { cls: 'sync-error',  label: '✕ Error' },
  }

  const { cls, label } = map[state as Exclude<SyncState, 'idle'>]
  return <span className={`sync-indicator ${cls}`}>{label}</span>
}
