import { useEffect, useRef, useState } from 'react'
import { Client, RuleType, ParsedFilePreview, getClients, getRuleTypes, parseDrlFile, confirmImport } from '../api/client'
import { useAuth } from '../context/AuthContext'

export function ImportDrl() {
  const { hasEditAccess } = useAuth()
  const [clients, setClients] = useState<Client[]>([])
  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [preview, setPreview] = useState<ParsedFilePreview | null>(null)
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedRuleTypeId, setSelectedRuleTypeId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([getClients(), getRuleTypes()]).then(([cs, rts]) => {
      setClients(cs)
      setRuleTypes(rts)
      if (cs.length > 0) setSelectedClientId(cs[0].id)
      if (rts.length > 0) setSelectedRuleTypeId(rts[0].id)
    }).catch(() => {
      setError('Failed to load clients and rule types')
    })
  }, [])

  async function handleFile(file: File) {
    if (!file.name.endsWith('.drl')) { setError('Only .drl files are accepted'); return }
    setError(''); setSuccess(''); setLoading(true)
    try {
      const p = await parseDrlFile(file)
      setPreview(p)
    } catch { setError('Failed to parse file — make sure it is a valid .drl file') }
    finally { setLoading(false) }
  }

  async function handleConfirm() {
    if (!preview || !selectedClientId || !selectedRuleTypeId) return
    setLoading(true); setError('')
    try {
      const rules = preview.rules.map(r => ({
        client_id: selectedClientId,
        rule_type_id: selectedRuleTypeId,
        name: r.name,
        condition_raw: r.condition_raw,
        action_raw: r.action_raw,
      }))
      const result = await confirmImport(rules)
      setSuccess(`✓ ${result.imported} rule${result.imported !== 1 ? 's' : ''} imported successfully`)
      setPreview(null)
    } catch { setError('Import failed') }
    finally { setLoading(false) }
  }

  return (
    <>
      <div style={{ margin: '20px 0 16px' }}>
        <h2 style={{ margin: 0 }}>Import DRL</h2>
        <p className="muted" style={{ margin: '4px 0 0' }}>
          Upload a .drl file to extract rules and add them to a client's rule library.
        </p>
      </div>

      {/* Assignment selectors */}
      <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
        <p style={{ margin: '0 0 12px', fontWeight: 600 }}>Assign imported rules to:</p>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="imp-client">Client</label>
            <select id="imp-client" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="imp-ruletype">Rule Type</label>
            <select id="imp-ruletype" value={selectedRuleTypeId} onChange={e => setSelectedRuleTypeId(e.target.value)}>
              {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.pipeline_stage}. {rt.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--line)'}`,
          borderRadius: 10,
          padding: '40px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? '#f0f6ff' : '#fafcff',
          marginBottom: 16,
          transition: 'all 0.15s',
        }}
      >
        <p style={{ margin: 0, fontSize: 16, color: 'var(--muted)' }}>
          Drop a .drl file here or <strong style={{ color: 'var(--accent)' }}>click to browse</strong>
        </p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }} className="muted">
          One file at a time. The file will be parsed and previewed before importing.
        </p>
        <input ref={fileRef} type="file" accept=".drl" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      {error && <p className="error-msg">{error}</p>}
      {success && <p style={{ color: 'var(--ok)', fontWeight: 600 }}>{success}</p>}
      {loading && <p className="muted">Processing…</p>}

      {/* Preview table */}
      {preview && (
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{preview.filename}</strong>
              <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>
                {preview.rule_count} rule{preview.rule_count !== 1 ? 's' : ''} · package: {preview.package}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline btn-sm" onClick={() => setPreview(null)}>Clear</button>
              {!hasEditAccess(selectedClientId) && <p className="error-msg">You do not have edit access to this client.</p>}
              <button className="btn-primary btn-sm" onClick={handleConfirm} disabled={loading || !hasEditAccess(selectedClientId)}>
                Confirm Import
              </button>
            </div>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Rule Name</th><th>Condition (when)</th><th>Action (then)</th></tr>
            </thead>
            <tbody>
              {preview.rules.map((r, i) => (
                <tr key={i}>
                  <td className="muted">{i + 1}</td>
                  <td><strong>{r.name}</strong></td>
                  <td><code style={{ fontSize: 12 }}>{r.condition_raw.slice(0, 80)}{r.condition_raw.length > 80 ? '…' : ''}</code></td>
                  <td><code style={{ fontSize: 12 }}>{r.action_raw.slice(0, 60)}{r.action_raw.length > 60 ? '…' : ''}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
