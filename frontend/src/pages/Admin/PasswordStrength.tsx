interface Score { score: 0 | 1 | 2 | 3 | 4; label: string }

export function scorePassword(pw: string): Score {
  if (!pw) return { score: 0, label: 'Empty' }
  let s = 1
  if (pw.length >= 8) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const capped = Math.min(s, 4) as Score['score']
  const labels = ['Empty', 'Weak', 'Fair', 'Good', 'Strong']
  return { score: capped, label: labels[capped] }
}

export function PasswordStrength({ value }: { value: string }) {
  const { score, label } = scorePassword(value)
  const colors = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--info)', 'var(--ok)']
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
      <div style={{ display: 'flex', gap: 4, height: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            background: i < score ? colors[score] : 'var(--bg-sunken)',
          }} />
        ))}
      </div>
      <span className="small muted">{label}</span>
    </div>
  )
}
