import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

interface Project {
  project_id: string
  client_name: string
  address: string
  total_sqft?: number
  num_floors?: number
  wall_material?: string
  construction_type?: string
  status: string
  created_at: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  finalized: 'Finalized',
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    client_name: '',
    address: '',
    total_sqft: '',
    num_floors: '',
    construction_type: 'new_build',
    wall_material: 'drywall',
    notes: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.get('/projects').then(r => setProjects(r.data)).finally(() => setLoading(false))
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    try {
      const r = await api.post('/projects', {
        client_name: form.client_name,
        address: form.address,
        total_sqft: form.total_sqft ? parseFloat(form.total_sqft) : undefined,
        num_floors: form.num_floors ? parseInt(form.num_floors) : undefined,
        construction_type: form.construction_type,
        wall_material: form.wall_material,
        notes: form.notes || undefined,
      })
      setProjects([r.data, ...projects])
      setShowModal(false)
      setForm({ client_name: '', address: '', total_sqft: '', num_floors: '', construction_type: 'new_build', wall_material: 'drywall', notes: '' })
      navigate(`/projects/${r.data.project_id}`)
    } catch {
      // error handled by interceptor
    } finally {
      setCreating(false)
    }
  }

  async function handleLogout() {
    await api.post('/auth/logout').catch(() => null)
    navigate('/login')
  }

  return (
    <div>
      <nav className="nav">
        <span className="nav-title">HomePlan</span>
        <div className="nav-actions">
          <button className="btn btn-sm btn-ghost" style={{ color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.3)' }} onClick={handleLogout}>Sign Out</button>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 32, paddingBottom: 32 }}>
        <div className="section-header">
          <h2 style={{ fontSize: '1.25rem' }}>Projects</h2>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Project</button>
        </div>

        {loading ? (
          <div className="page-loading"><span className="spinner" /> Loading…</div>
        ) : projects.length === 0 ? (
          <div className="empty-state card">
            <h3>No projects yet</h3>
            <p>Create your first WiFi infrastructure plan.</p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>+ New Project</button>
          </div>
        ) : (
          <div>
            {projects.map(p => (
              <div key={p.project_id} className="list-item" onClick={() => navigate(`/projects/${p.project_id}`)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.client_name}</div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{p.address}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.total_sqft && <span>{p.total_sqft.toLocaleString()} sqft</span>}
                    {p.num_floors && <span>{p.num_floors} floors</span>}
                    {p.wall_material && <span>{p.wall_material}</span>}
                  </div>
                </div>
                <span className={`badge badge-${p.status === 'in_review' ? 'in-review' : p.status}`}>
                  {STATUS_LABELS[p.status] || p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
          <div className="modal">
            <div className="modal-header">
              <h2>New Project</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="field">
                  <label>Client Name *</label>
                  <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} required />
                </div>
                <div className="field">
                  <label>Address *</label>
                  <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} required />
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Total Sq Ft</label>
                    <input type="number" value={form.total_sqft} onChange={e => setForm(f => ({ ...f, total_sqft: e.target.value }))} min="100" />
                  </div>
                  <div className="field">
                    <label>Number of Floors</label>
                    <input type="number" value={form.num_floors} onChange={e => setForm(f => ({ ...f, num_floors: e.target.value }))} min="1" max="10" />
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Construction Type</label>
                    <select value={form.construction_type} onChange={e => setForm(f => ({ ...f, construction_type: e.target.value }))}>
                      <option value="new_build">New Build</option>
                      <option value="renovation">Renovation</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Wall Material</label>
                    <select value={form.wall_material} onChange={e => setForm(f => ({ ...f, wall_material: e.target.value }))}>
                      <option value="drywall">Drywall</option>
                      <option value="brick">Brick</option>
                      <option value="concrete">Concrete</option>
                      <option value="log">Log</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label>Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <span className="spinner" /> : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
