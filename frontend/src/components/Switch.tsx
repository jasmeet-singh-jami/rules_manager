interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  title?: string
  ariaLabel?: string
}

export function Switch({ checked, onChange, title, ariaLabel }: SwitchProps) {
  return (
    <label className="switch" title={title} onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={ariaLabel} />
      <span className="track" />
    </label>
  )
}
