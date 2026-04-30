import type { AstNode, BuilderConfig, BuilderField, CmpNode, FieldRef, FnCall, LiteralNode, Operand, RawNode } from '../conditionAst'

interface Props {
  node: CmpNode | RawNode
  config: BuilderConfig
  onChange: (node: AstNode) => void
  onRemove: () => void
}

const STRING_OPS = ['==', '!=', 'matches', 'not matches', 'contains', 'not contains']
const NUMBER_OPS = ['==', '!=', '<', '>', '<=', '>=']
const ENUM_OPS = ['==', '!=']
const FN_OPS = ['==', '!=', '<', '>', '<=', '>=']

function opsForField(field: BuilderField | undefined): string[] {
  if (!field) return [...STRING_OPS, '<', '>', '<=', '>=']
  if (field.type === 'enum') return ENUM_OPS
  if (field.type === 'number') return NUMBER_OPS
  return STRING_OPS
}

function leftType(node: CmpNode, _config: BuilderConfig): 'field' | 'fn' | 'unknown' {
  const left = node.left
  if ('path' in left) return 'field'
  if ('name' in left) return 'fn'
  return 'unknown'
}

function getFieldName(op: Operand): string {
  if ('path' in op) return (op as FieldRef).path[0] ?? ''
  return ''
}

function getFnName(op: Operand): string {
  if ('name' in op) return (op as FnCall).name
  return ''
}

function getRightValue(right: Operand): string {
  if ('value' in right) return (right as LiteralNode).value
  return ''
}

function makeRight(value: string, field: import('../conditionAst').BuilderField | undefined, op: string): LiteralNode {
  if (field?.type === 'number' || op === '<' || op === '>' || op === '<=' || op === '>=') {
    return { kind: 'number', value }
  }
  if (op === 'matches' || op === 'not matches') {
    return { kind: 'regex', value }
  }
  return { kind: 'string', value }
}

export function ComparisonRow({ node, config, onChange, onRemove }: Props) {
  if (node.kind === 'raw') {
    return (
      <div className="builder-row" style={{ gap: 8, alignItems: 'center' }}>
        <span className="badge neutral mono" style={{ fontSize: 11 }}>raw</span>
        <input
          className="mono"
          style={{ flex: 1, fontSize: 12 }}
          value={node.text}
          onChange={e => onChange({ ...node, text: e.target.value })}
        />
        <button className="btn sm ghost danger" onClick={onRemove} title="Remove">×</button>
      </div>
    )
  }

  const cmp = node as CmpNode
  const lType = leftType(cmp, config)
  const fieldName = lType === 'field' ? getFieldName(cmp.left) : ''
  const fnName = lType === 'fn' ? getFnName(cmp.left) : ''
  const field = config.fields.find(f => f.name === fieldName)
  const opOptions = lType === 'fn' ? FN_OPS : opsForField(field)
  const rightValue = getRightValue(cmp.right)

  function setField(name: string) {
    const f = config.fields.find(x => x.name === name)
    const ops = opsForField(f)
    const newOp = ops.includes(cmp.op) ? cmp.op : ops[0]
    const newRight: LiteralNode = f?.type === 'enum'
      ? { kind: 'string', value: f.enum?.[0] ?? '' }
      : makeRight(rightValue, f, newOp)
    onChange({ ...cmp, op: newOp, left: { path: [name] } as FieldRef, right: newRight })
  }

  function setFn(name: string) {
    const fn: FnCall = { name, args: config.helper_functions.find(h => h.name === name)?.args.map(() => ({ kind: 'binding' as const })) ?? [] }
    onChange({ ...cmp, left: fn })
  }

  function setOp(op: string) {
    const newRight = makeRight(rightValue, field, op)
    onChange({ ...cmp, op, right: newRight })
  }

  function setRight(value: string) {
    onChange({ ...cmp, right: makeRight(value, field, cmp.op) })
  }

  const leftModeIsField = lType !== 'fn'

  return (
    <div className="builder-row" style={{ gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Left operand selector */}
      <select
        value={leftModeIsField ? `f:${fieldName}` : `fn:${fnName}`}
        onChange={e => {
          const v = e.target.value
          if (v.startsWith('f:')) setField(v.slice(2))
          else setFn(v.slice(3))
        }}
        style={{ minWidth: 120 }}
      >
        <optgroup label="Fields">
          {config.fields.map(f => (
            <option key={f.name} value={`f:${f.name}`}>{f.label}</option>
          ))}
        </optgroup>
        {config.helper_functions.length > 0 && (
          <optgroup label="Functions">
            {config.helper_functions.map(h => (
              <option key={h.name} value={`fn:${h.name}`}>{h.name}()</option>
            ))}
          </optgroup>
        )}
      </select>

      {/* Operator */}
      <select value={cmp.op} onChange={e => setOp(e.target.value)} style={{ minWidth: 100 }}>
        {opOptions.map(op => (
          <option key={op} value={op}>{op}</option>
        ))}
      </select>

      {/* Right operand */}
      {field?.type === 'enum' ? (
        <select value={rightValue} onChange={e => setRight(e.target.value)} style={{ minWidth: 100 }}>
          {field.enum?.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      ) : (
        <input
          type={field?.type === 'number' || lType === 'fn' ? 'number' : 'text'}
          value={rightValue}
          onChange={e => setRight(e.target.value)}
          placeholder={cmp.op === 'matches' || cmp.op === 'not matches' ? 'regex pattern' : 'value'}
          style={{ flex: 1, minWidth: 100 }}
          className={cmp.op === 'matches' || cmp.op === 'not matches' ? 'mono' : undefined}
        />
      )}

      <button className="btn sm ghost" onClick={onRemove} title="Remove condition" style={{ padding: '2px 6px' }}>×</button>
    </div>
  )
}
