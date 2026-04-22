import { useEffect, useMemo, useState } from 'react'
import { useClients } from '../context/ClientContext'
import {
  getRuleTypes, getRules, parseDrlFile, confirmImport,
  type RuleType, type Rule, type ParsedFilePreview,
} from '../api/client'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

export function ImportDrl() {
  const { toast } = useToast()
  const { selectedClientId } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [ruleTypeId, setRuleTypeId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedFilePreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set())
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { getRuleTypes().then(setRuleTypes) }, [])
  useEffect(() => {
    if (!selectedClientId || !ruleTypeId) { setExistingNames(new Set()); return }
    getRules({ client_id: selectedClientId, rule_type: ruleTypeId })
      .then(rs => setExistingNames(new Set(rs.map((r: Rule) => r.name))))
      .catch(() => setExistingNames(new Set()))
  }, [selectedClientId, ruleTypeId])

  const onChoose = async (f: File) => {
    setFile(f); setParsing(true); setPreview(null)
    try {
      const p = await parseDrlFile(f)
      setPreview(p)
      setSelected(new Set(p.rules.map(r => r.name)))
    } catch {
      toast('Parse failed', 'danger')
    } finally {
      setParsing(false)
    }
  }

  const toggle = (name: string) => {
    setSelected(prev => { const n = new Set(prev); if (n.has(name)) { n.delete(name) } else { n.add(name) } return n })
  }
  const toggleAll = () => {
    if (!preview) return
    setSelected(prev => prev.size === preview.rules.length ? new Set() : new Set(preview.rules.map(r => r.name)))
  }

  const canImport = !!(preview && selectedClientId && ruleTypeId && selected.size > 0)
  const duplicates = useMemo(
    () => new Set(preview?.rules.filter(r => existingNames.has(r.name)).map(r => r.name) ?? []),
    [preview, existingNames],
  )

  const onConfirm = async () => {
    if (!preview || !selectedClientId || !ruleTypeId) return
    setSubmitting(true)
    try {
      const payload = {
        rule_type_id: ruleTypeId,
        functions: preview.functions,
        imports: preview.imports,
        rules: preview.rules
          .filter(r => selected.has(r.name))
          .map(r => ({
            client_id: selectedClientId, rule_type_id: ruleTypeId,
            name: r.name, condition_raw: r.condition_raw, action_raw: r.action_raw,
            required_function_names: r.required_function_names ?? [],
            required_import_statements: r.required_import_statements ?? [],
          })),
      }
      const res = await confirmImport(payload)
      toast(`Imported ${res.imported} rule(s)`, 'ok')
      setFile(null); setPreview(null); setSelected(new Set())
    } catch {
      toast('Import failed', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  if (!selectedClientId) {
    return <div className="page"><EmptyState icon="clients" title="Pick a client" /></div>
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Import DRL</h1>
          <div className="page-sub">Upload a .drl file to extract rules into the library</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Target</div>
          <div className="form-row">
            <div className="field">
              <label>Rule type</label>
              <select className="select" value={ruleTypeId}
                      onChange={e => setRuleTypeId(e.target.value)}>
                <option value="">Choose rule type…</option>
                {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
              </select>
            </div>
          </div>
          <div className="divider" />
          <div style={{
            border: '2px dashed var(--border-strong)', borderRadius: 10,
            padding: '32px 20px', textAlign: 'center', background: 'var(--bg-sunken)',
          }}
          onDragOver={e => { e.preventDefault() }}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) onChoose(f) }}>
            <div style={{ margin: '0 auto 10px', width: 40, height: 40, borderRadius: 10,
                          background: 'var(--accent-soft)', color: 'var(--accent)',
                          display: 'grid', placeItems: 'center' }}>
              <Icon name="upload" size={20} />
            </div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Drop .drl file here</div>
            <div className="small muted" style={{ marginBottom: 12 }}>or click to choose</div>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              Choose file
              <input type="file" accept=".drl,.txt" hidden
                     onChange={e => e.target.files?.[0] && onChoose(e.target.files[0])} />
            </label>
            {file && <div className="small muted" style={{ marginTop: 10 }}>{file.name}</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Preview</div>
            {preview && (
              <span className="tb-meta">{selected.size} of {preview.rules.length} selected</span>
            )}
          </div>
          {parsing ? (
            <div className="empty">Parsing…</div>
          ) : !preview ? (
            <EmptyState icon="upload" title="Upload to preview"
              body="Rules extracted from the DRL file will appear here." />
          ) : (
            <>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)',
                            display: 'flex', gap: 16, fontSize: 12.5, color: 'var(--muted)' }}>
                <span>Package: <span className="mono">{preview.package}</span></span>
                <span>Functions: {preview.functions.length}</span>
                <span>Imports: {preview.imports.length}</span>
              </div>
              <table className="rules">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input type="checkbox" className="cbx"
                             checked={selected.size === preview.rules.length && preview.rules.length > 0}
                             onChange={toggleAll} />
                    </th>
                    <th>Rule name</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rules.map(r => (
                    <tr key={r.name}>
                      <td className="col-check">
                        <input type="checkbox" className="cbx"
                               checked={selected.has(r.name)}
                               onChange={() => toggle(r.name)} />
                      </td>
                      <td>
                        <div className="cell-name">{r.name}</div>
                        {duplicates.has(r.name) && (
                          <span className="badge warn" style={{ marginTop: 4 }}>
                            <Icon name="alertTri" size={11} /> already exists
                          </span>
                        )}
                      </td>
                      <td><div className="cell-cond">{r.condition_raw || <span className="muted">—</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: 12, borderTop: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn sm ghost" onClick={() => { setPreview(null); setFile(null) }}>Clear</button>
                <button className="btn sm accent" disabled={!canImport || submitting} onClick={onConfirm}>
                  {submitting ? 'Importing…' : `Import ${selected.size} rule(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
