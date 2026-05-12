import { useEffect, useState } from 'react'
import api from '../api/client'

interface AP {
  ap_id: string
  project_id: string
  plan_id: string
  x: number
  y: number
  mount_type: string
  recommended_model?: string
  coverage_radius_ft: number
  ai_generated: boolean
  ai_rationale?: string
  planner_confirmed: boolean
  connected_to_rack_id?: string
  estimated_cable_run_ft?: number
  notes?: string
}

interface Rack {
  rack_id: string
  label: string
}

interface Props {
  ap: AP
  racks: Rack[]
  onUpdate: (updated: AP) => void
  onDelete: (apId: string) => void
  onClose: () => void
}

export default function APSidePanel({ ap, racks, onUpdate, onDelete, onClose }: Props) {
  const [form, setForm] = useState({
    recommended_model: ap.recommended_model || '',
    mount_type: ap.mount_type || 'ceiling',
    coverage_radius_ft: String(ap.coverage_radius_ft || 21.8),
    connected_to_rack_id: ap.connected_to_rack_id || '',
    notes: ap.notes || '',
    planner_confirmed: ap.planner_confirmed,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      recommended_model: ap.recommended_model || '',
      mount_type: ap.mount_type || 'ceiling',
      coverage_radius_ft: String(ap.coverage_radius_ft || 21.8),
      connected_to_rack_id: ap.connected_to_rack_id || '',
      notes: ap.notes || '',
      planner_confirmed: ap.planner_confirmed,
    })
  }, [ap.ap_id])

  async function save(overrides?: Partial<typeof form>) {
    const merged = { ...form, ...overrides }
    setSaving(true)
    try {
      const r = await api.patch(`/projects/${ap.project_id}/aps/${ap.ap_id}`, {
        recommended_model: merged.recommended_model || undefined,
        mount_type: merged.mount_type,
        coverage_radius_ft: parseFloat(merged.coverage_radius_ft) || 21.8,
        connected_to_rack_id: merged.connected_to_rack_id || undefined,
        notes: merged.notes || undefined,
        planner_confirmed: merged.planner_confirmed,
      })
      onUpdate(r.data)
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirm() {
    const next = { ...form, planner_confirmed: true }
    setForm(next)
    await save(next)
  }

  async function handleDelete() {
    if (!confirm('Delete this access point?')) return
    await api.delete(`/projects/${ap.project_id}/aps/${ap.ap_id}`)
    onDelete(ap.ap_id)
    onClose()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Access Point</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {ap.ai_generated ? (
              <span className="badge badge-ai" style={{ fontSize: '0.7rem' }}>AI Proposed</span>
            ) : (
              <span className="badge badge-confirmed" style={{ fontSize: '0.7rem' }}>Manual</span>
            )}
            {ap.planner_confirmed && (
              <span className="badge badge-confirmed" style={{ fontSize: '0.7rem', marginLeft: 4 }}>Confirmed</span>
            )}
          </div>
        </div>
        <button className="modal-close" onClick={onClose}>✕</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {ap.ai_rationale && (
          <div className="alert alert-info" style={{ fontSize: '0.8rem', marginBottom: 12 }}>
            <strong>AI Rationale:</strong> {ap.ai_rationale}
          </div>
        )}

        <div className="field">
          <label>Model</label>
          <input
            value={form.recommended_model}
            onChange={e => setForm(f => ({ ...f, recommended_model: e.target.value }))}
            placeholder="e.g. Ruckus R650"
            onBlur={() => save()}
          />
        </div>

        <div className="field">
          <label>Mount Type</label>
          <select value={form.mount_type} onChange={e => { setForm(f => ({ ...f, mount_type: e.target.value })); save({ mount_type: e.target.value }) }}>
            <option value="ceiling">Ceiling</option>
            <option value="wall_high">Wall High</option>
            <option value="wall_low">Wall Low</option>
          </select>
        </div>

        <div className="field">
          <label>Coverage Radius (ft)</label>
          <input
            type="number"
            value={form.coverage_radius_ft}
            onChange={e => setForm(f => ({ ...f, coverage_radius_ft: e.target.value }))}
            step="0.5"
            min="5"
            max="60"
            onBlur={() => save()}
          />
        </div>

        <div className="field">
          <label>Connected Rack</label>
          <select value={form.connected_to_rack_id} onChange={e => { setForm(f => ({ ...f, connected_to_rack_id: e.target.value })); save({ connected_to_rack_id: e.target.value }) }}>
            <option value="">Unassigned</option>
            {racks.map(r => (
              <option key={r.rack_id} value={r.rack_id}>{r.label}</option>
            ))}
          </select>
        </div>

        {ap.estimated_cable_run_ft && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            Estimated cable run: <strong>{ap.estimated_cable_run_ft} ft</strong>
          </div>
        )}

        <div className="field">
          <label>Notes</label>
          <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} onBlur={() => save()} />
        </div>

        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          Position: ({Math.round(ap.x)}, {Math.round(ap.y)})
        </div>
      </div>

      <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        {!ap.planner_confirmed && (
          <button className="btn btn-accent btn-full" disabled={saving} onClick={handleConfirm}>
            {saving ? <span className="spinner" /> : 'Confirm AP'}
          </button>
        )}
        {ap.planner_confirmed && (
          <button className="btn btn-ghost btn-full" disabled={saving} onClick={() => { setForm(f => ({ ...f, planner_confirmed: false })); save({ planner_confirmed: false }) }}>
            Unconfirm
          </button>
        )}
        <button className="btn btn-danger" onClick={handleDelete} style={{ flexShrink: 0 }}>Delete</button>
      </div>
    </div>
  )
}
