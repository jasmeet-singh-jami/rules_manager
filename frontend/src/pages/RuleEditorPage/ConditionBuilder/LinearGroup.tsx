import { Fragment } from 'react'
import type { AstNode, BuilderConfig, CmpNode, GroupNode, RawNode } from '../conditionAst'
import { flattenToLevel, levelToAst, newCmpNode, newExplicitGroup } from '../conditionAst'
import { ComparisonRow } from './ComparisonRow'

interface Props {
  node: AstNode
  config: BuilderConfig
  onChange: (node: AstNode) => void
  onRemove?: () => void
  depth: number
  maxDepth?: number
}

export function LinearGroup({ node, config, onChange, onRemove, depth, maxDepth = 2 }: Props) {
  const level = flattenToLevel(node)
  const isNested = depth > 0
  const canAddGroup = config.allow_groups && depth < maxDepth

  function commit(items: AstNode[], joins: ('and' | 'or')[]) {
    onChange(levelToAst({ items, joins }))
  }

  function updateItem(i: number, next: AstNode) {
    const items = [...level.items]
    items[i] = next
    commit(items, level.joins)
  }

  function removeItem(i: number) {
    const items = level.items.filter((_, idx) => idx !== i)
    let joins: ('and' | 'or')[]
    if (level.items.length <= 1) joins = []
    else if (i === 0) joins = level.joins.slice(1)
    else joins = [...level.joins.slice(0, i - 1), ...level.joins.slice(i)]
    commit(items, joins)
  }

  function toggleJoin(i: number) {
    const joins = [...level.joins]
    joins[i] = joins[i] === 'and' ? 'or' : 'and'
    commit(level.items, joins)
  }

  function addCondition(joinOp: 'and' | 'or') {
    const items = [...level.items, newCmpNode(config)]
    const joins = level.items.length === 0 ? [] : [...level.joins, joinOp]
    commit(items, joins)
  }

  function addGroup(joinOp: 'and' | 'or') {
    const innerCombinator = level.items.length === 0 ? 'and' : (joinOp === 'and' ? 'or' : 'and')
    const items = [...level.items, newExplicitGroup(config, innerCombinator)]
    const joins = level.items.length === 0 ? [] : [...level.joins, joinOp]
    commit(items, joins)
  }

  return (
    <div className={`linear-group${isNested ? ' nested' : ''}`}>
      {isNested && (
        <div className="linear-group-head">
          <span className="linear-group-label">Group</span>
          {onRemove && (
            <button
              className="linear-group-remove"
              onClick={onRemove}
              type="button"
              title="Remove group"
              aria-label="Remove group"
            >
              ×
            </button>
          )}
        </div>
      )}

      <div className="linear-group-body">
        {level.items.length === 0 && (
          <div className="linear-empty small muted">No conditions yet.</div>
        )}

        {level.items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <button
                type="button"
                className={`combinator-pill ${level.joins[i - 1]}`}
                onClick={() => toggleJoin(i - 1)}
                title="Click to toggle AND / OR"
              >
                {level.joins[i - 1].toUpperCase()}
              </button>
            )}
            {item.kind === 'group' ? (
              <LinearGroup
                node={item as GroupNode}
                config={config}
                onChange={updated => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
                depth={depth + 1}
                maxDepth={maxDepth}
              />
            ) : (
              <ComparisonRow
                node={item as CmpNode | RawNode}
                config={config}
                onChange={updated => updateItem(i, updated)}
                onRemove={() => removeItem(i)}
              />
            )}
          </Fragment>
        ))}
      </div>

      <div className="linear-group-actions">
        {level.items.length === 0 ? (
          <>
            <button type="button" className="btn sm ghost" onClick={() => addCondition('and')}>+ Add condition</button>
            {canAddGroup && (
              <button type="button" className="btn sm ghost" onClick={() => addGroup('and')}>+ Add group</button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="btn sm ghost action-and" onClick={() => addCondition('and')}>+ AND</button>
            <button type="button" className="btn sm ghost action-or" onClick={() => addCondition('or')}>+ OR</button>
            {canAddGroup && (
              <button type="button" className="btn sm ghost action-group" onClick={() => addGroup('and')}>+ Group</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
