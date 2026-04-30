import { useState } from 'react'
import type { BuilderConfig, ConditionMeta, RawNode } from '../conditionAst'
import { emptyConditionMeta, parseCondition, renderCondition } from '../conditionAst'
import { LinearGroup } from './LinearGroup'

interface Props {
  conditionRaw: string
  conditionMeta: ConditionMeta | null
  builderConfig: BuilderConfig | null
  slug: string
  templateKey: string
  onChangeRaw: (raw: string) => void
  onChangeMeta: (meta: ConditionMeta | null) => void
}

export function ConditionBuilder({
  conditionRaw,
  conditionMeta,
  builderConfig,
  slug,
  templateKey,
  onChangeRaw,
  onChangeMeta,
}: Props) {
  const [parseFailed, setParseFailed] = useState(false)

  // issue_correlation and slugs without builder_config stay raw-only (no mode picker)
  if (!builderConfig || slug === 'issue_correlation') {
    return (
      <div className="field">
        <textarea
          value={conditionRaw}
          onChange={e => { onChangeRaw(e.target.value); onChangeMeta(null) }}
          placeholder='e.g. sourceId == "LogicMonitor" && severity > 3'
          style={{ minHeight: 140 }}
        />
      </div>
    )
  }

  const mode: 'builder' | 'raw' = conditionMeta?.mode ?? 'raw'

  function switchToBuilder() {
    const { meta, confidence } = parseCondition(conditionRaw, builderConfig!, templateKey)
    if (confidence >= 0.5) {
      const next: ConditionMeta = { ...meta, mode: 'builder' }
      onChangeMeta(next)
      onChangeRaw(renderCondition(next, builderConfig!))
      setParseFailed(false)
    } else {
      setParseFailed(true)
      const emptyMeta = emptyConditionMeta(builderConfig!, templateKey)
      onChangeMeta(emptyMeta)
      onChangeRaw(renderCondition(emptyMeta, builderConfig!))
    }
  }

  function switchToManual() {
    if (mode === 'builder' && !window.confirm(
      'Switch to Manual mode? The structured builder state will be cleared on next save.',
    )) return
    const next: ConditionMeta = conditionMeta
      ? { ...conditionMeta, mode: 'raw', expression: null }
      : { schema_version: 1, mode: 'raw', template_key: templateKey, bindings: builderConfig ? [builderConfig.binding] : [], expression: null }
    onChangeMeta(next)
  }

  function handleMetaChange(updated: ConditionMeta) {
    onChangeMeta(updated)
    onChangeRaw(renderCondition(updated, builderConfig!))
  }

  const isBuilder = mode === 'builder'

  return (
    <div className="condition-builder">
      {/* Mode tab picker */}
      <div className="mode-tabs" style={{ marginBottom: 12 }}>
        <button
          className={`mode-tab${!isBuilder ? ' active' : ''}`}
          onClick={switchToManual}
          type="button"
        >
          Manual
        </button>
        <button
          className={`mode-tab${isBuilder ? ' active' : ''}`}
          onClick={switchToBuilder}
          type="button"
        >
          Builder
        </button>
      </div>

      {!isBuilder && parseFailed && (
        <div className="condition-banner warn" style={{ marginBottom: 10 }}>
          Could not parse this condition into the Builder. Switch to Builder to start over — this will replace the current raw text.
        </div>
      )}

      {isBuilder ? (
        <BuilderBody
          conditionMeta={conditionMeta!}
          conditionRaw={conditionRaw}
          config={builderConfig!}
          onMetaChange={handleMetaChange}
        />
      ) : (
        <div className="field">
          <textarea
            value={conditionRaw}
            onChange={e => {
              onChangeRaw(e.target.value)
              onChangeMeta(conditionMeta ? { ...conditionMeta, mode: 'raw' } : null)
            }}
            placeholder='e.g. request:NoiseSuppressionRequest(groupedAlert.sourceId == "LogicMonitor" && ...)'
            style={{ minHeight: 140 }}
          />
        </div>
      )}

      {isBuilder && conditionRaw && (
        <div style={{ marginTop: 12 }}>
          <div className="small muted" style={{ marginBottom: 4, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Generated DRL</div>
          <div className="drl-preview-inline">
            {conditionRaw}
          </div>
        </div>
      )}
    </div>
  )
}

function BuilderBody({
  conditionMeta,
  conditionRaw: _,
  config,
  onMetaChange,
}: {
  conditionMeta: ConditionMeta
  conditionRaw: string
  config: BuilderConfig
  onMetaChange: (m: ConditionMeta) => void
}) {
  const expr = conditionMeta.expression

  if (expr && expr.kind === 'raw') {
    return (
      <div>
        <div style={{ marginBottom: 8, padding: '8px 12px', borderRadius: 6, fontSize: 13, background: 'var(--warn-bg, #fffbe6)', border: '1px solid var(--warn-border, #ffe58f)' }}>
          This condition could not be fully parsed. Edit inline or switch to Manual mode.
        </div>
        <div className="field">
          <textarea
            value={(expr as RawNode).text}
            onChange={e => onMetaChange({ ...conditionMeta, expression: { kind: 'raw', text: e.target.value } })}
            style={{ minHeight: 80 }}
            className="mono"
          />
        </div>
      </div>
    )
  }

  // Empty or any structural node — LinearGroup handles all cases (cmp, group, empty).
  const root = expr ?? { kind: 'group' as const, combinator: 'and' as const, children: [], implicit: true }
  return (
    <LinearGroup
      node={root}
      config={config}
      onChange={updated => onMetaChange({ ...conditionMeta, expression: updated })}
      depth={0}
    />
  )
}
