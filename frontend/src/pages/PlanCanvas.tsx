import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/client'
import APSidePanel from '../components/APSidePanel'
import CanvasStage from '../components/CanvasStage'
import FloorSwitcher from '../components/FloorSwitcher'
import HandoffPanel from '../components/HandoffPanel'
import SyncIndicator from '../components/SyncIndicator'

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
  project_id: string
  plan_id: string
  x: number
  y: number
  label: string
  is_primary: boolean
}

interface Plan {
  plan_id: string
  plan_type: string
  floor_number: string
  rendered_png_s3_key: string
  scale_ppf: number | null
}

type SyncState = 'idle' | 'saving' | 'saved' | 'error'

export default function PlanCanvas() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [plans, setPlans] = useState<Plan[]>([])
  const [aps, setAPs] = useState<AP[]>([])
  const [racks, setRacks] = useState<Rack[]>([])
  const [project, setProject] = useState<{ client_name: string } | null>(null)
  const [activePlanId, setActivePlanId] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [selectedAP, setSelectedAP] = useState<AP | null>(null)
  const [loading, setLoading] = useState(true)
  const [sync, setSync] = useState<SyncState>('idle')
  const [calibrating, setCalibrating] = useState(false)
  const [proposing, setProposing] = useState(false)
  const [placingRack, setPlacingRack] = useState(false)
  const [placingAP, setPlacingAP] = useState(false)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/projects/${projectId}/plans`),
      api.get(`/projects/${projectId}/aps`),
      api.get(`/projects/${projectId}/racks`),
    ]).then(([projRes, planRes, apRes, rackRes]) => {
      setProject(projRes.data)
      const allPlans: Plan[] = planRes.data
      setPlans(allPlans)
      setAPs(apRes.data)
      setRacks(rackRes.data)
      const floorPlans = allPlans.filter(p => p.plan_type === 'floor')
      if (floorPlans.length > 0) setActivePlanId(floorPlans[0].plan_id)
    }).finally(() => setLoading(false))
  }, [projectId])

  // Load presigned image URL when active plan changes
  useEffect(() => {
    const plan = plans.find(p => p.plan_id === activePlanId)
    if (!plan?.rendered_png_s3_key) { setImageUrl(null); return }
    api.get(`/media/presigned/${plan.rendered_png_s3_key}`)
      .then(r => setImageUrl(r.data.url))
      .catch(() => setImageUrl(null))
  }, [activePlanId, plans])

  function setSyncAndClear(state: SyncState) {
    setSync(state)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    if (state === 'saved' || state === 'error') {
      syncTimerRef.current = setTimeout(() => setSync('idle'), 2000)
    }
  }

  async function handleAPDragEnd(apId: string, x: number, y: number) {
    setSyncAndClear('saving')
    try {
      const r = await api.patch(`/projects/${projectId}/aps/${apId}`, { x, y })
      setAPs(prev => prev.map(a => a.ap_id === apId ? r.data : a))
      if (selectedAP?.ap_id === apId) setSelectedAP(r.data)
      setSyncAndClear('saved')
    } catch {
      setSyncAndClear('error')
    }
  }

  async function handleRackDragEnd(rackId: string, x: number, y: number) {
    setSyncAndClear('saving')
    try {
      const r = await api.patch(`/projects/${projectId}/racks/${rackId}`, { x, y })
      setRacks(prev => prev.map(rk => rk.rack_id === rackId ? r.data : rk))
      setSyncAndClear('saved')
    } catch {
      setSyncAndClear('error')
    }
  }

  async function handleCalibrate(scalePPF: number) {
    if (!activePlanId) return
    setSyncAndClear('saving')
    try {
      const r = await api.patch(`/projects/${projectId}/plans/${activePlanId}`, { scale_ppf: scalePPF })
      setPlans(prev => prev.map(p => p.plan_id === activePlanId ? { ...p, scale_ppf: r.data.scale_ppf } : p))
      setSyncAndClear('saved')
    } catch {
      setSyncAndClear('error')
    }
    setCalibrating(false)
  }

  async function handleStageClick(x: number, y: number) {
    if (!activePlanId) return

    if (placingRack) {
      setPlacingRack(false)
      setSyncAndClear('saving')
      try {
        const r = await api.post(`/projects/${projectId}/racks`, {
          plan_id: activePlanId,
          x, y,
          label: `IDF-${racks.length + 1}`,
          is_primary: racks.length === 0,
        })
        setRacks(prev => [...prev, r.data])
        setSyncAndClear('saved')
      } catch {
        setSyncAndClear('error')
      }
      return
    }

    if (placingAP) {
      setPlacingAP(false)
      setSyncAndClear('saving')
      try {
        const r = await api.post(`/projects/${projectId}/aps`, {
          plan_id: activePlanId,
          x, y,
          mount_type: 'ceiling',
          coverage_radius_ft: 21.8,
          planner_confirmed: true,
        })
        setAPs(prev => [...prev, r.data])
        setSyncAndClear('saved')
      } catch {
        setSyncAndClear('error')
      }
      return
    }
  }

  async function proposeAPs() {
    setProposing(true)
    setSelectedAP(null)
    try {
      const r = await api.post(`/projects/${projectId}/propose-aps`)
      // Merge new APs (replace existing AI unconfirmed)
      setAPs(prev => {
        const keepManual = prev.filter(a => !a.ai_generated || a.planner_confirmed)
        return [...keepManual, ...r.data.aps]
      })
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'AI proposal failed.'
      alert(msg)
    } finally {
      setProposing(false)
    }
  }

  const activePlan = plans.find(p => p.plan_id === activePlanId) ?? null
  const activeAPs = aps.filter(ap => ap.plan_id === activePlanId)
  const activeRacks = racks.filter(r => r.plan_id === activePlanId)
  const confirmedCount = aps.filter(a => a.planner_confirmed).length

  if (loading) return <div className="page-loading"><span className="spinner" /> Loading canvas…</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh' }}>
      {/* Top nav */}
      <nav className="nav" style={{ padding: '10px 16px' }}>
        <button className="nav-back" onClick={() => navigate(`/projects/${projectId}`)}>←</button>
        <span className="nav-title" style={{ fontSize: '0.9rem' }}>
          {project?.client_name ?? 'Canvas'}
        </span>

        {/* Floor switcher in nav */}
        <FloorSwitcher plans={plans} activePlanId={activePlanId ?? ''} onSelect={setActivePlanId} />

        <div className="nav-actions">
          <SyncIndicator state={sync} />

          {/* Calibrate */}
          <button
            className={`btn btn-sm ${calibrating ? 'btn-danger' : 'btn-ghost'}`}
            style={{ color: calibrating ? 'white' : 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
            onClick={() => { setCalibrating(c => !c); setPlacingRack(false); setPlacingAP(false) }}
          >
            {calibrating ? 'Cancel Calibrate' : 'Calibrate Scale'}
          </button>

          {/* Place rack */}
          <button
            className={`btn btn-sm ${placingRack ? 'btn-danger' : 'btn-ghost'}`}
            style={{ color: placingRack ? 'white' : 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
            onClick={() => { setPlacingRack(r => !r); setPlacingAP(false); setCalibrating(false) }}
          >
            {placingRack ? 'Cancel' : '+ Rack'}
          </button>

          {/* Place AP manually */}
          <button
            className={`btn btn-sm ${placingAP ? 'btn-danger' : 'btn-ghost'}`}
            style={{ color: placingAP ? 'white' : 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.3)' }}
            onClick={() => { setPlacingAP(a => !a); setPlacingRack(false); setCalibrating(false) }}
          >
            {placingAP ? 'Cancel' : '+ AP'}
          </button>

          {/* AI Propose */}
          <button
            className="btn btn-sm btn-accent"
            onClick={proposeAPs}
            disabled={proposing}
          >
            {proposing ? <span className="spinner-white" /> : 'Propose APs'}
          </button>
        </div>
      </nav>

      {/* Canvas + sidebar */}
      <div className="canvas-workspace">
        <div className="canvas-main">
          {!imageUrl && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>🗺️</div>
                <p>No plan image loaded</p>
              </div>
            </div>
          )}

          <CanvasStage
            imageUrl={imageUrl}
            aps={activeAPs}
            racks={activeRacks}
            activePlan={activePlan}
            calibrating={calibrating}
            onAPDragEnd={handleAPDragEnd}
            onRackDragEnd={handleRackDragEnd}
            onAPSelect={ap => { setSelectedAP(ap); setCalibrating(false); setPlacingRack(false); setPlacingAP(false) }}
            onRackSelect={() => {}}
            onCalibrate={handleCalibrate}
            onCancelCalibrate={() => setCalibrating(false)}
            onStageClick={handleStageClick}
            placingRack={placingRack}
            placingAP={placingAP}
          />

          {proposing && (
            <div className="canvas-loading-overlay">
              <span className="spinner-white" style={{ width: 32, height: 32, borderWidth: 3 }} />
              <p>AI is analyzing floor plans…</p>
              <p style={{ fontSize: '0.8rem', opacity: 0.6 }}>This may take 15–30 seconds</p>
            </div>
          )}

          {(placingRack || placingAP) && (
            <div style={{
              position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(48,43,99,0.9)', color: 'white', padding: '8px 16px',
              borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: 500,
              pointerEvents: 'none',
            }}>
              Click on the plan to place {placingRack ? 'the rack' : 'an AP'}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="canvas-sidebar">
          {selectedAP ? (
            <APSidePanel
              ap={selectedAP}
              racks={racks}
              onUpdate={updated => {
                setAPs(prev => prev.map(a => a.ap_id === updated.ap_id ? updated : a))
                setSelectedAP(updated)
              }}
              onDelete={apId => setAPs(prev => prev.filter(a => a.ap_id !== apId))}
              onClose={() => setSelectedAP(null)}
            />
          ) : (
            <>
              {/* Calibration status */}
              <div className="canvas-sidebar-section">
                <h3>Calibration</h3>
                {activePlan?.scale_ppf ? (
                  <div>
                    <span className="badge badge-calibrated">Calibrated</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      {activePlan.scale_ppf.toFixed(2)} px/ft
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="badge badge-uncalibrated">Not Calibrated</span>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      Use "Calibrate Scale" to set px/ft before running AI proposals.
                    </p>
                  </div>
                )}
              </div>

              {/* AP summary */}
              <div className="canvas-sidebar-section">
                <h3>Access Points</h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <div>{activeAPs.filter(a => a.planner_confirmed).length} confirmed</div>
                  <div>{activeAPs.filter(a => !a.planner_confirmed).length} AI draft</div>
                  <div style={{ marginTop: 4, fontSize: '0.8rem' }}>Click an AP to edit or confirm it.</div>
                </div>
              </div>

              {/* Racks summary */}
              <div className="canvas-sidebar-section">
                <h3>Racks / IDF</h3>
                {activeRacks.length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No racks on this floor. Use "+ Rack" to place one.</p>
                ) : (
                  activeRacks.map(r => (
                    <div key={r.rack_id} style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                      {r.label} {r.is_primary ? '(Primary)' : ''}
                    </div>
                  ))
                )}
              </div>

              {/* Handoff panel */}
              <div className="canvas-sidebar-section" style={{ flex: 1 }}>
                <h3>Handoff Package</h3>
                <HandoffPanel projectId={projectId!} confirmedAPCount={confirmedCount} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
