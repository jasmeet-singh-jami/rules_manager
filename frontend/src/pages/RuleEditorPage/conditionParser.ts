export interface CondRow { field: string; op: string; value: string }

export const CONDITION_OPS = ['==','!=','<','>','<=','>=','matches','not matches','contains'] as const

export function parseCondition(str: string, prefix = ''): CondRow[] {
  if (!str) return [{ field: '', op: '==', value: '' }]
  const parts = str.split(/\s*&&\s*/)
  return parts.map(p => {
    const m = p.match(/^([^=!<>]+?)\s*(==|!=|<=|>=|<|>|matches|not matches|contains)\s*(.+)$/i)
    if (!m) return { field: p.trim(), op: '==', value: '' }
    let field = m[1].trim()
    if (prefix && field.startsWith(prefix + '.')) field = field.slice(prefix.length + 1)
    const value = m[3].trim().replace(/^["']|["']$/g, '')
    return { field, op: m[2], value }
  })
}

export function stringifyCondition(rows: CondRow[], prefix = ''): string {
  return rows
    .filter(r => r.field.trim())
    .map(r => {
      const field = prefix && !r.field.includes('.') ? `${prefix}.${r.field}` : r.field
      const v = r.value
      const needsQuotes = v !== '' && !/^[0-9]+(\.[0-9]+)?$/.test(v) && v !== 'true' && v !== 'false'
      const quoted = needsQuotes ? `"${v}"` : v
      return `${field} ${r.op} ${quoted}`
    })
    .join(' && ')
}
