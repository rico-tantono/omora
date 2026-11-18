import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  right?: ReactNode
}

export default function PageHeader({ title, subtitle, right }: Props) {
  return (
    <header className="pt-safe px-5 pb-3">
      <div className="flex items-end justify-between gap-3 pt-5">
        <div className="min-w-0">
          <h1 className="font-display text-[2rem] leading-tight font-medium text-ember-900">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  )
}
