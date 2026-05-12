import Konva from 'konva'
import { KonvaEventObject } from 'konva/lib/Node'
import { useEffect, useRef, useState } from 'react'
import { Image as KonvaImage, Layer, Stage } from 'react-konva'
import APMarker from './APMarker'
import CalibrationOverlay from './CalibrationOverlay'
import CableRunLayer from './CableRunLayer'
import RackMarker from './RackMarker'

interface AP {
  ap_id: string
  x: number
  y: number
  coverage_radius_ft: number
  ai_generated: boolean
  planner_confirmed: boolean
  recommended_model?: string
  connected_to_rack_id?: string
}

interface Rack {
  rack_id: string
  x: number
  y: number
  label: string
  is_primary: boolean
  plan_id?: string
}

interface Plan {
  plan_id: string
  scale_ppf: number | null
}

interface Props {
  imageUrl: string | null
  aps: AP[]
  racks: Rack[]
  activePlan: Plan | null
  calibrating: boolean
  onAPDragEnd: (apId: string, x: number, y: number) => void
  onRackDragEnd: (rackId: string, x: number, y: number) => void
  onAPSelect: (ap: unknown) => void
  onRackSelect: (rack: unknown) => void
  onCalibrate: (scalePPF: number) => void
  onCancelCalibrate: () => void
  onStageClick: (x: number, y: number) => void
  placingRack: boolean
  placingAP: boolean
}

export default function CanvasStage({
  imageUrl, aps, racks, activePlan, calibrating,
  onAPDragEnd, onRackDragEnd, onAPSelect, onRackSelect,
  onCalibrate, onCancelCalibrate, onStageClick,
  placingRack, placingAP,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: width, h: height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Load image
  useEffect(() => {
    if (!imageUrl) { setImage(null); return }
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      setImage(img)
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
      // Fit image to stage
      if (stageRef.current) {
        const scaleX = dims.w / img.naturalWidth
        const scaleY = dims.h / img.naturalHeight
        const scale = Math.min(scaleX, scaleY, 1)
        stageRef.current.scale({ x: scale, y: scale })
        stageRef.current.position({
          x: (dims.w - img.naturalWidth * scale) / 2,
          y: (dims.h - img.naturalHeight * scale) / 2,
        })
      }
    }
    img.src = imageUrl
  }, [imageUrl])

  function handleWheel(e: KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()!
    const scaleBy = 1.08
    const newScale = e.evt.deltaY < 0
      ? Math.min(oldScale * scaleBy, 10)
      : Math.max(oldScale / scaleBy, 0.05)

    stage.scale({ x: newScale, y: newScale })
    stage.position({
      x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
      y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
    })
  }

  function handleStageClick(e: KonvaEventObject<MouseEvent>) {
    // Only fire for stage/background clicks (not marker clicks)
    if (e.target !== e.target.getStage() && e.target.getClassName() !== 'Image') return
    const pos = stageRef.current?.getRelativePointerPosition()
    if (pos) onStageClick(pos.x, pos.y)
  }

  function resetView() {
    if (!stageRef.current || !imgSize.w) return
    const scaleX = dims.w / imgSize.w
    const scaleY = dims.h / imgSize.h
    const scale = Math.min(scaleX, scaleY, 1)
    stageRef.current.scale({ x: scale, y: scale })
    stageRef.current.position({
      x: (dims.w - imgSize.w * scale) / 2,
      y: (dims.h - imgSize.h * scale) / 2,
    })
  }

  const cursor = calibrating ? 'crosshair' : placingRack || placingAP ? 'crosshair' : undefined

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Stage
        ref={stageRef}
        width={dims.w}
        height={dims.h}
        draggable={!calibrating && !placingRack && !placingAP}
        onWheel={handleWheel}
        onClick={handleStageClick}
        style={{ cursor }}
      >
        {/* Background layer */}
        <Layer>
          {image && (
            <KonvaImage
              image={image}
              width={imgSize.w}
              height={imgSize.h}
            />
          )}
        </Layer>

        {/* Cable runs */}
        <CableRunLayer aps={aps} racks={racks} />

        {/* Markers layer */}
        <Layer>
          {racks.map(rack => (
            <RackMarker
              key={rack.rack_id}
              rack={rack}
              onDragEnd={onRackDragEnd}
              onSelect={onRackSelect}
            />
          ))}
          {aps.map(ap => (
            <APMarker
              key={ap.ap_id}
              ap={ap}
              scalePPF={activePlan?.scale_ppf ?? null}
              onDragEnd={onAPDragEnd}
              onSelect={onAPSelect}
            />
          ))}
        </Layer>

        {/* Calibration overlay (renders its own Layer) */}
        {calibrating && (
          <CalibrationOverlay
            onCalibrate={onCalibrate}
            onCancel={onCancelCalibrate}
            stageRef={stageRef as unknown as React.RefObject<{ getPointerPosition: () => { x: number; y: number } | null }>}
          />
        )}
      </Stage>

      {/* Reset view button */}
      <button
        onClick={resetView}
        style={{
          position: 'absolute', bottom: 16, right: 16,
          background: 'rgba(48,43,99,0.8)', color: 'white', border: 'none',
          borderRadius: 'var(--radius)', padding: '6px 12px', fontSize: '0.8rem',
          cursor: 'pointer',
        }}
      >
        Reset View
      </button>
    </div>
  )
}
