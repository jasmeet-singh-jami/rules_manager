interface SwitchProps {
  checked: boolean
  onChange: (next: boolean) => void
  title?: string
}

export function Switch({ checked, onChange, title }: SwitchProps) {
  return (
    <label className="switch" title={title} onClick={e => e.stopPropagation()}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="track" />
    </label>
  )
}
