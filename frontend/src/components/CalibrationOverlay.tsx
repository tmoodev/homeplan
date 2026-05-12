import { useEffect, useState } from 'react'
import { Circle, Layer, Line } from 'react-konva'

interface Point { x: number; y: number }

interface Props {
  onCalibrate: (scalePPF: number) => void
  onCancel: () => void
  stageRef: React.RefObject<{ getPointerPosition: () => Point | null }>
}

interface DistanceDialogProps {
  pixelDist: number
  onConfirm: (feet: number) => void
  onCancel: () => void
}

function DistanceDialog({ pixelDist, onConfirm, onCancel }: DistanceDialogProps) {
  const [feet, setFeet] = useState('')

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 360 }}>
        <div className="modal-header">
          <h2>Enter Real-World Distance</h2>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12 }}>
            You drew a line of {Math.round(pixelDist)} pixels. What is the real-world distance in feet?
          </p>
          <div className="field">
            <label>Distance (feet)</label>
            <input
              type="number"
              value={feet}
              onChange={e => setFeet(e.target.value)}
              min="0.5"
              step="0.5"
              autoFocus
              placeholder="e.g. 20"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!feet || parseFloat(feet) <= 0}
            onClick={() => onConfirm(parseFloat(feet))}
          >
            Set Scale
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CalibrationOverlay({ onCalibrate, onCancel, stageRef }: Props) {
  const [point1, setPoint1] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [point2, setPoint2] = useState<Point | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [pixelDist, setPixelDist] = useState(0)

  useEffect(() => {
    const stage = stageRef.current as unknown as { on: (evt: string, fn: () => void) => void; off: (evt: string) => void; getPointerPosition: () => Point | null }
    if (!stage) return

    const handleMouseMove = () => {
      const pos = stage.getPointerPosition()
      if (pos) setCursor(pos)
    }

    const handleClick = () => {
      const pos = stage.getPointerPosition()
      if (!pos) return

      if (!point1) {
        setPoint1(pos)
      } else if (!point2) {
        const dist = Math.sqrt((pos.x - point1.x) ** 2 + (pos.y - point1.y) ** 2)
        setPoint2(pos)
        setPixelDist(dist)
        setShowDialog(true)
      }
    }

    stage.on('mousemove', handleMouseMove)
    stage.on('click', handleClick)
    return () => {
      stage.off('mousemove')
      stage.off('click')
    }
  }, [point1, point2, stageRef])

  function handleConfirm(feet: number) {
    if (!pixelDist || feet <= 0) return
    onCalibrate(pixelDist / feet)
  }

  const linePoints = point1 && cursor ? [point1.x, point1.y, cursor.x, cursor.y] : null

  return (
    <>
      <Layer listening={false}>
        {point1 && (
          <Circle x={point1.x} y={point1.y} radius={6} fill="#f59e0b" stroke="white" strokeWidth={2} />
        )}
        {linePoints && (
          <Line points={linePoints} stroke="#f59e0b" strokeWidth={2} dash={[6, 4]} />
        )}
        {point2 && (
          <Circle x={point2.x} y={point2.y} radius={6} fill="#f59e0b" stroke="white" strokeWidth={2} />
        )}
      </Layer>

      {!point1 && !showDialog && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(245,158,11,0.9)', color: 'white', padding: '8px 16px',
          borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: 500, zIndex: 10,
          pointerEvents: 'none',
        }}>
          Click two points to measure a known distance
          <button
            style={{ marginLeft: 12, background: 'rgba(0,0,0,0.2)', border: 'none', color: 'white', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', pointerEvents: 'all' }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      )}

      {point1 && !showDialog && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(245,158,11,0.9)', color: 'white', padding: '8px 16px',
          borderRadius: 'var(--radius)', fontSize: '0.85rem', fontWeight: 500, zIndex: 10,
          pointerEvents: 'none',
        }}>
          Click the second point to complete the measurement
        </div>
      )}

      {showDialog && (
        <DistanceDialog
          pixelDist={pixelDist}
          onConfirm={handleConfirm}
          onCancel={onCancel}
        />
      )}
    </>
  )
}
