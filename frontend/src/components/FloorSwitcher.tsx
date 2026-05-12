interface Plan {
  plan_id: string
  floor_number: string
  plan_type: string
  scale_ppf: number | null
}

interface Props {
  plans: Plan[]
  activePlanId: string
  onSelect: (planId: string) => void
}

export default function FloorSwitcher({ plans, activePlanId, onSelect }: Props) {
  const floorPlans = plans.filter(p => p.plan_type === 'floor')
  if (floorPlans.length <= 1) return null

  return (
    <div className="floor-switcher">
      {floorPlans.map(p => (
        <button
          key={p.plan_id}
          className={`floor-tab ${p.plan_id === activePlanId ? 'active' : ''}`}
          onClick={() => onSelect(p.plan_id)}
        >
          Floor {p.floor_number}
          {!p.scale_ppf && <span style={{ color: 'var(--warn)', marginLeft: 4 }}>!</span>}
        </button>
      ))}
    </div>
  )
}
