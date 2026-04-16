interface Props {
  ruleName: string
  conditionRaw: string
  actionRaw: string
  ruleTypeName?: string
}

export function DrlPreview({ ruleName, conditionRaw, actionRaw, ruleTypeName }: Props) {
  const preview = [
    `// ${ruleTypeName ?? 'rule type'}`,
    `rule "${ruleName || 'RuleName'}"`,
    '\twhen',
    ...(conditionRaw.trim() ? conditionRaw.split('\n').map(l => `\t\t${l}`) : ['\t\t// condition here']),
    '\tthen',
    ...(actionRaw.trim() ? actionRaw.split('\n').map(l => `\t\t${l}`) : ['\t\t// action here']),
    'end',
  ].join('\n')

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <label style={{ marginBottom: 6 }}>Live DRL Preview</label>
      <pre style={{
        minHeight: 280,
        maxHeight: 480,
        background: 'linear-gradient(160deg, #0f1e3a 0%, #071020 100%)',
        color: '#7dd3fc',
        borderRadius: 12,
        padding: 16,
        margin: 0,
        fontSize: 12,
        lineHeight: 1.7,
        overflow: 'auto',
        fontFamily: "'Fira Code', 'Consolas', monospace",
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        border: '1px solid rgba(29,106,229,0.3)',
        boxShadow: '0 4px 20px rgba(29,78,216,0.15)',
      }}>
        {preview}
      </pre>
    </div>
  )
}
