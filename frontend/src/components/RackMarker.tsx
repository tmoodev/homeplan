import { Group, Rect, Text } from 'react-konva'

interface Rack {
  rack_id: string
  x: number
  y: number
  label: string
  is_primary: boolean
}

interface Props {
  rack: Rack
  onDragEnd: (rackId: string, x: number, y: number) => void
  onSelect: (rack: Rack) => void
}

const W = 32
const H = 24

export default function RackMarker({ rack, onDragEnd, onSelect }: Props) {
  return (
    <Group
      x={rack.x - W / 2}
      y={rack.y - H / 2}
      draggable
      onDragEnd={e => onDragEnd(rack.rack_id, e.target.x() + W / 2, e.target.y() + H / 2)}
      onClick={() => onSelect(rack)}
    >
      <Rect
        width={W}
        height={H}
        fill={rack.is_primary ? 'rgba(48,43,99,0.75)' : 'rgba(71,85,105,0.65)'}
        stroke={rack.is_primary ? '#7c6fc4' : '#94a3b8'}
        strokeWidth={2}
        cornerRadius={3}
      />
      <Text
        text={rack.label}
        width={W}
        height={H}
        align="center"
        verticalAlign="middle"
        fontSize={9}
        fontStyle="bold"
        fill="white"
      />
      <Text
        text={rack.is_primary ? 'MDF' : 'IDF'}
        y={H + 2}
        width={W}
        align="center"
        fontSize={8}
        fill="#94a3b8"
      />
    </Group>
  )
}
