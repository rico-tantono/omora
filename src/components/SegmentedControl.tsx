interface Option<T extends string> {
  id: T
  label: string
}

interface Props<T extends string> {
  label: string
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
}

export default function SegmentedControl<T extends string>({ label, value, options, onChange }: Props<T>) {
  const index = Math.max(0, options.findIndex((o) => o.id === value))
  return (
    <div
      role="tablist"
      aria-label={label}
      className="glass relative grid rounded-xl p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-lg transition-transform duration-[550ms] ease-[cubic-bezier(0.25,0.8,0.25,1)]"
        style={{
          left: 4,
          width: `calc((100% - 8px) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
          background: 'linear-gradient(160deg, #FF7F61 0%, #FF6B4A 100%)',
          boxShadow: '0 1px 2px rgba(125, 32, 32, 0.3)',
        }}
      />
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`relative z-10 h-11 rounded-lg text-sm font-semibold transition-colors duration-[350ms] ${
              on ? 'text-on-accent' : 'text-ink-soft'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
