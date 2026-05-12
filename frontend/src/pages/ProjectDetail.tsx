import { useCallback, useEffect, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import SyncIndicator from '../components/SyncIndicator'

interface Project {
  project_id: string
  client_name: string
  address: string
  total_sqft?: number
  num_floors?: number
  construction_type?: string
  wall_material?: string
  status: string
  notes?: string
}

interface Plan {
  plan_id: string
  plan_type: string
  floor_number: string
  original_file_type: string
  rendered_png_s3_key: string
  scale_ppf: number | null
  uploaded_at: string
}

type SyncState = 'idle' | 'saving' | 'saved' | 'error'

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<SyncState>('idle')
  const [uploading, setUploading] = useState(false)
  const [uploadFloor, setUploadFloor] = useState('1')
  const [uploadType, setUploadType] = useState('floor')

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/projects/${projectId}/plans`),
    ]).then(([pRes, plRes]) => {
      setProject(pRes.data)
      setPlans(plRes.data)
    }).finally(() => setLoading(false))
  }, [projectId])

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', acceptedFiles[0])
      formData.append('plan_type', uploadType)
      formData.append('floor_number', uploadFloor)
      const r = await api.post(`/projects/${projectId}/plans`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setPlans(prev => [...prev, ...r.data.plans])
    } catch {
      // error handled by interceptor
    } finally {
      setUploading(false)
    }
  }, [projectId, uploadFloor, uploadType])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
    disabled: uploading,
  })

  async function deletePlan(planId: string) {
    if (!confirm('Delete this plan? All APs and racks on this floor will remain but lose their image.')) return
    await api.delete(`/projects/${projectId}/plans/${planId}`)
    setPlans(prev => prev.filter(p => p.plan_id !== planId))
  }

  async function updateStatus(status: string) {
    if (!project) return
    setSync('saving')
    try {
      const r = await api.patch(`/projects/${projectId}`, { status })
      setProject(r.data)
      setSync('saved')
    } catch {
      setSync('error')
    }
  }

  if (loading) return <div className="page-loading"><span className="spinner" /> Loading…</div>
  if (!project) return <div className="page-loading">Project not found.</div>

  const floorPlans = plans.filter(p => p.plan_type === 'floor')
  const hasCalibrated = floorPlans.some(p => p.scale_ppf)
  const allCalibrated = floorPlans.length > 0 && floorPlans.every(p => p.scale_ppf)

  return (
    <div>
      <nav className="nav">
        <button className="nav-back" onClick={() => navigate('/projects')}>←</button>
        <span className="nav-title">{project.client_name}</span>
        <div className="nav-actions">
          <SyncIndicator state={sync} />
          {floorPlans.length > 0 && (
            <button className="btn btn-sm btn-accent" onClick={() => navigate(`/projects/${projectId}/canvas`)}>
              Open Canvas
            </button>
          )}
        </div>
      </nav>

      <div className="container" style={{ paddingTop: 24, paddingBottom: 32 }}>
        {/* Project meta */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>{project.address}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {project.total_sqft && <span>{project.total_sqft.toLocaleString()} sqft</span>}
                {project.num_floors && <span>{project.num_floors} floors</span>}
                {project.construction_type && <span>{project.construction_type.replace('_', ' ')}</span>}
                {project.wall_material && <span>{project.wall_material} walls</span>}
              </div>
              {project.notes && <p style={{ marginTop: 8, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{project.notes}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={project.status}
                onChange={e => updateStatus(e.target.value)}
                style={{ width: 'auto', fontSize: '0.85rem', padding: '6px 10px' }}
              >
                <option value="draft">Draft</option>
                <option value="in_review">In Review</option>
                <option value="finalized">Finalized</option>
              </select>
              {allCalibrated && (
                <span className="badge badge-calibrated">All Calibrated</span>
              )}
              {!allCalibrated && hasCalibrated && (
                <span className="badge badge-in-review">Partially Calibrated</span>
              )}
            </div>
          </div>
        </div>

        {/* Upload new plan */}
        <div className="section-header">
          <h2>Floor Plans</h2>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-end' }}>
            <div className="field" style={{ marginBottom: 0, minWidth: 120 }}>
              <label>Plan Type</label>
              <select value={uploadType} onChange={e => setUploadType(e.target.value)} style={{ padding: '8px 10px' }}>
                <option value="floor">Floor Plan</option>
                <option value="elevation">Elevation</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0, minWidth: 120 }}>
              <label>Floor Number</label>
              <select value={uploadFloor} onChange={e => setUploadFloor(e.target.value)} style={{ padding: '8px 10px' }}>
                <option value="basement">Basement</option>
                <option value="1">Floor 1</option>
                <option value="2">Floor 2</option>
                <option value="3">Floor 3</option>
                <option value="4">Floor 4</option>
              </select>
            </div>
          </div>

          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            {uploading ? (
              <><span className="spinner" /> <p>Uploading and rasterizing…</p></>
            ) : isDragActive ? (
              <p>Drop the file here…</p>
            ) : (
              <>
                <div style={{ fontSize: '2rem' }}>📄</div>
                <p>Drag & drop a PDF or image, or click to select</p>
                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>PDF pages will each become a separate floor plan</p>
              </>
            )}
          </div>
        </div>

        {/* Plans list */}
        {plans.length === 0 ? (
          <div className="empty-state">
            <h3>No plans uploaded yet</h3>
            <p>Upload a floor plan PDF or image to get started.</p>
          </div>
        ) : (
          <div>
            {plans.map(plan => (
              <div key={plan.plan_id} className="list-item" style={{ cursor: 'default' }}>
                <div style={{ width: 48, height: 36, background: 'var(--bg)', borderRadius: 4, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                  🗺️
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>
                    {plan.plan_type === 'floor' ? 'Floor Plan' : 'Elevation'} — Floor {plan.floor_number}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                    <span>{plan.original_file_type.toUpperCase()}</span>
                    {plan.scale_ppf ? (
                      <span className="badge badge-calibrated" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                        Calibrated ({plan.scale_ppf.toFixed(1)} px/ft)
                      </span>
                    ) : (
                      <span className="badge badge-uncalibrated" style={{ fontSize: '0.7rem', padding: '1px 6px' }}>
                        Not Calibrated
                      </span>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-ghost"
                  style={{ color: 'var(--danger)' }}
                  onClick={() => deletePlan(plan.plan_id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        {floorPlans.length > 0 && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={() => navigate(`/projects/${projectId}/canvas`)}>
              Open Canvas Workspace →
            </button>
            {!allCalibrated && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Calibrate scale in the canvas before running AI proposals.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
