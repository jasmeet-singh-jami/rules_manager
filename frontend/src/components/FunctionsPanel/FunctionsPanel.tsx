import { useState } from 'react'
import {
  RuleType, DrlFunction, DrlImport,
  createRuleFunction, updateRuleFunction, deleteRuleFunction,
  createRuleImport, updateRuleImport, deleteRuleImport,
} from '../../api/client'

interface Props {
  ruleType: RuleType
}

export function FunctionsPanel({ ruleType }: Props) {
  const [functions, setFunctions] = useState<DrlFunction[]>(ruleType.functions)
  const [imports, setImports] = useState<DrlImport[]>(ruleType.imports)

  const [newFnName, setNewFnName] = useState('')
  const [newFnBody, setNewFnBody] = useState('')
  const [addingFn, setAddingFn] = useState(false)
  const [editFn, setEditFn] = useState<DrlFunction | null>(null)

  const [newImpStmt, setNewImpStmt] = useState('')
  const [newImpKind, setNewImpKind] = useState<'import' | 'global'>('import')
  const [newImpShared, setNewImpShared] = useState(false)
  const [addingImp, setAddingImp] = useState(false)

  const [error, setError] = useState('')

  async function handleAddFunction() {
    if (!newFnName.trim() || !newFnBody.trim()) return
    try {
      const fn = await createRuleFunction(ruleType.id, { name: newFnName.trim(), body: newFnBody.trim() })
      setFunctions(prev => [...prev, fn])
      setNewFnName(''); setNewFnBody(''); setAddingFn(false)
    } catch { setError('Failed to add function') }
  }

  async function handleUpdateFunction() {
    if (!editFn) return
    try {
      const fn = await updateRuleFunction(ruleType.id, editFn.id, { name: editFn.name, body: editFn.body })
      setFunctions(prev => prev.map(f => f.id === fn.id ? fn : f))
      setEditFn(null)
    } catch { setError('Failed to update function') }
  }

  async function handleDeleteFunction(id: string) {
    try {
      await deleteRuleFunction(ruleType.id, id)
      setFunctions(prev => prev.filter(f => f.id !== id))
    } catch { setError('Failed to delete function') }
  }

  async function handleAddImport() {
    if (!newImpStmt.trim()) return
    try {
      const imp = await createRuleImport(ruleType.id, { statement: newImpStmt.trim(), kind: newImpKind, is_shared: newImpShared })
      setImports(prev => [...prev, imp])
      setNewImpStmt(''); setNewImpKind('import'); setNewImpShared(false); setAddingImp(false)
    } catch { setError('Failed to add import') }
  }

  async function handleToggleShared(imp: DrlImport) {
    try {
      const updated = await updateRuleImport(ruleType.id, imp.id, { is_shared: !imp.is_shared })
      setImports(prev => prev.map(i => i.id === updated.id ? updated : i))
    } catch { setError('Failed to update import') }
  }

  async function handleDeleteImport(id: string) {
    try {
      await deleteRuleImport(ruleType.id, id)
      setImports(prev => prev.filter(i => i.id !== id))
    } catch { setError('Failed to delete import') }
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {error && <p className="error-msg" style={{ margin: '0 0 10px' }}>{error}</p>}

      {/* Functions */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>Functions ({functions.length})</strong>
          <button className="btn-outline btn-sm" onClick={() => setAddingFn(v => !v)}>
            {addingFn ? 'Cancel' : '+ Add Function'}
          </button>
        </div>

        {addingFn && (
          <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Name</label>
              <input value={newFnName} onChange={e => setNewFnName(e.target.value)} placeholder="e.g. extractPort" style={{ fontSize: 12 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Body</label>
              <textarea rows={5} value={newFnBody} onChange={e => setNewFnBody(e.target.value)}
                placeholder="function extractPort(String s) { ... }" style={{ fontSize: 12, fontFamily: 'monospace' }} />
            </div>
            <button className="btn-primary btn-sm" onClick={handleAddFunction}>Save Function</button>
          </div>
        )}

        {editFn && (
          <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Name</label>
              <input value={editFn.name} onChange={e => setEditFn(f => f && { ...f, name: e.target.value })} style={{ fontSize: 12 }} />
            </div>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Body</label>
              <textarea rows={6} value={editFn.body} onChange={e => setEditFn(f => f && { ...f, body: e.target.value })}
                style={{ fontSize: 12, fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-primary btn-sm" onClick={handleUpdateFunction}>Update</button>
              <button className="btn-outline btn-sm" onClick={() => setEditFn(null)}>Cancel</button>
            </div>
          </div>
        )}

        {functions.length === 0 && !addingFn && <p className="muted" style={{ fontSize: 12 }}>No functions defined.</p>}
        {functions.map(fn => (
          <div key={fn.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <code style={{ fontSize: 12, color: 'var(--accent)' }}>{fn.name}</code>
              <pre style={{ margin: '2px 0 0', fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--muted)', maxHeight: 80, overflow: 'hidden' }}>
                {fn.body.slice(0, 200)}{fn.body.length > 200 ? '…' : ''}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0 }}>
              <button className="btn-outline btn-sm" onClick={() => setEditFn(fn)} style={{ fontSize: 11 }}>Edit</button>
              <button className="btn-outline btn-sm" onClick={() => handleDeleteFunction(fn.id)} style={{ fontSize: 11, color: 'var(--danger)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Imports */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong style={{ fontSize: 13 }}>Imports & Globals ({imports.length})</strong>
          <button className="btn-outline btn-sm" onClick={() => setAddingImp(v => !v)}>
            {addingImp ? 'Cancel' : '+ Add Import'}
          </button>
        </div>

        {addingImp && (
          <div style={{ background: 'rgba(124,58,237,0.04)', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginBottom: 10 }}>
            <div className="form-row" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12 }}>Statement</label>
              <input value={newImpStmt} onChange={e => setNewImpStmt(e.target.value)}
                placeholder="import com.example.dto.AlertDto;" style={{ fontSize: 12, fontFamily: 'monospace' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, alignItems: 'center' }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: 12 }}>Kind</label>
                <select value={newImpKind} onChange={e => setNewImpKind(e.target.value as 'import' | 'global')} style={{ fontSize: 12 }}>
                  <option value="import">import</option>
                  <option value="global">global</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={newImpShared} onChange={e => setNewImpShared(e.target.checked)} style={{ width: 'auto' }} />
                Always include (shared)
              </label>
            </div>
            <button className="btn-primary btn-sm" onClick={handleAddImport}>Save Import</button>
          </div>
        )}

        {imports.length === 0 && !addingImp && <p className="muted" style={{ fontSize: 12 }}>No imports defined.</p>}
        {imports.map(imp => (
          <div key={imp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 11, background: imp.kind === 'global' ? 'rgba(234,179,8,0.15)' : 'rgba(124,58,237,0.1)',
                color: imp.kind === 'global' ? '#a16207' : 'var(--accent)', borderRadius: 4, padding: '1px 6px', flexShrink: 0 }}>
                {imp.kind}
              </span>
              <code style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imp.statement}</code>
              {imp.is_shared && (
                <span style={{ fontSize: 11, color: 'var(--ok)', flexShrink: 0 }}>shared</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, marginLeft: 12, flexShrink: 0, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }} title="Always include in generated DRL">
                <input type="checkbox" checked={imp.is_shared} onChange={() => handleToggleShared(imp)} style={{ width: 'auto' }} />
                shared
              </label>
              <button className="btn-outline btn-sm" onClick={() => handleDeleteImport(imp.id)} style={{ fontSize: 11, color: 'var(--danger)' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
