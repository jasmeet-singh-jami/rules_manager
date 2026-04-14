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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <label style={{ marginBottom: 6 }}>Live DRL Preview</label>
      <pre style={{
        flex: 1,
        background: '#1e2d3d',
        color: '#c8d8e8',
        borderRadius: 8,
        padding: 14,
        margin: 0,
        fontSize: 12,
        lineHeight: 1.6,
        overflow: 'auto',
        fontFamily: 'Consolas, monospace',
        whiteSpace: 'pre',
      }}>
        {preview}
      </pre>
    </div>
  )
}
