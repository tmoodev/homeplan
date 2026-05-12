import { Circle, Group, Text } from 'react-konva'

interface AP {
  ap_id: string
  x: number
  y: number
  coverage_radius_ft: number
  ai_generated: boolean
  planner_confirmed: boolean
  recommended_model?: string
}

interface Props {
  ap: AP
  scalePPF: number | null
  onDragEnd: (apId: string, x: number, y: number) => void
  onSelect: (ap: AP) => void
}

export default function APMarker({ ap, scalePPF, onDragEnd, onSelect }: Props) {
  const isConfirmed = ap.planner_confirmed
  const isAI = ap.ai_generated && !isConfirmed

  // Coverage radius in pixels (only show if calibrated)
  const coverageRadius = scalePPF && scalePPF > 0
    ? (ap.coverage_radius_ft || 21.8) * scalePPF
    : 0

  const fillColor = isConfirmed
    ? 'rgba(16,185,129,0.55)'
    : isAI
      ? 'rgba(124,111,196,0.45)'
      : 'rgba(245,158,11,0.55)'

  const strokeColor = isConfirmed ? '#10b981' : isAI ? '#7c6fc4' : '#f59e0b'
  const strokeDash = isAI ? [6, 4] : undefined
  const coverageFill = isConfirmed ? 'rgba(16,185,129,0.06)' : 'rgba(124,111,196,0.05)'
  const coverageStroke = isConfirmed ? '#10b981' : '#7c6fc4'

  return (
    <Group
      x={ap.x}
      y={ap.y}
      draggable
      onDragEnd={e => onDragEnd(ap.ap_id, e.target.x(), e.target.y())}
      onClick={() => onSelect(ap)}
    >
      {/* Coverage circle */}
      {coverageRadius > 0 && (
        <Circle
          radius={coverageRadius}
          fill={coverageFill}
          stroke={coverageStroke}
          strokeWidth={1}
          dash={isAI ? [8, 6] : undefined}
          opacity={0.7}
          listening={false}
        />
      )}
      {/* AP dot */}
      <Circle
        radius={10}
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        dash={strokeDash}
      />
      {/* Model label */}
      <Text
        text={ap.recommended_model?.split(' ').slice(-1)[0] || 'AP'}
        fontSize={8}
        fill="white"
        align="center"
        width={20}
        x={-10}
        y={-4}
        listening={false}
      />
    </Group>
  )
}
