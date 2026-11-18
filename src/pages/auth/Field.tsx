import { useRef, useState, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  error?: string | null
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  inputMode?: 'text' | 'email'
  disabled?: boolean
  tone?: 'dark' | 'light' // dark = over a photo, light = on paper
  hint?: ReactNode
}

export default function Field({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  disabled,
  tone = 'light',
  hint,
}: Props) {
  const [reveal, setReveal] = useState(false)
  const lastError = useRef('')
  if (error) lastError.current = error

  const dark = tone === 'dark'
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  return (
    <div>
      <label htmlFor={id} className={`mb-1.5 block text-sm font-medium ${dark ? 'text-white/90' : 'text-ink'}`}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={isPassword && reveal ? 'text' : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          autoComplete={autoComplete}
          inputMode={inputMode}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-lg border px-4 text-ink transition-[border-color,box-shadow] duration-[350ms] placeholder:text-ink-soft/60 focus:outline-none disabled:opacity-60 ${
            isPassword ? 'pr-12' : ''
          } ${dark ? 'bg-paper' : 'bg-card'} ${
            error
              ? 'border-ember-700 focus:shadow-[0_0_0_3px_rgba(197,48,48,0.18)]'
              : 'border-ink/15 focus:border-ember-700 focus:shadow-[0_0_0_3px_rgba(197,48,48,0.18)]'
          }`}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide password' : 'Show password'}
            aria-pressed={reveal}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ink-soft"
          >
            {reveal ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-[350ms] ease-out ${
          error ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <p
          id={`${id}-error`}
          className={`overflow-hidden text-[13px] leading-snug ${dark ? 'text-[#FFC9BD]' : 'text-ember-700'}`}
        >
          <span className="block pt-1.5">{error ?? lastError.current}</span>
        </p>
      </div>

      {hint && !error && (
        <p id={`${id}-hint`} className={`mt-1.5 text-[13px] ${dark ? 'text-white/65' : 'text-ink-soft'}`}>
          {hint}
        </p>
      )}
    </div>
  )
}
