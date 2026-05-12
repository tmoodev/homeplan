import { Layer, Line } from 'react-konva'

interface AP {
  ap_id: string
  x: number
  y: number
  planner_confirmed: boolean
  connected_to_rack_id?: string
}

interface Rack {
  rack_id: string
  x: number
  y: number
}

interface Props {
  aps: AP[]
  racks: Rack[]
}

export default function CableRunLayer({ aps, racks }: Props) {
  const racksById = Object.fromEntries(racks.map(r => [r.rack_id, r]))

  return (
    <Layer listening={false}>
      {aps
        .filter(ap => ap.planner_confirmed && ap.connected_to_rack_id)
        .map(ap => {
          const rack = racksById[ap.connected_to_rack_id!]
          if (!rack) return null
          return (
            <Line
              key={ap.ap_id}
              points={[ap.x, ap.y, rack.x, rack.y]}
              stroke="rgba(148,163,184,0.5)"
              strokeWidth={1.5}
              dash={[5, 4]}
              listening={false}
            />
          )
        })}
    </Layer>
  )
}
