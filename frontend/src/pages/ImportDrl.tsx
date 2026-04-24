import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import {
  getRuleTypes, getRules, parseDrlFile, confirmImport,
  type RuleType, type Rule, type ParsedFilePreview,
} from '../api/client'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'

export function ImportDrl() {
  const [searchParams] = useSearchParams()
  const { toast } = useToast()
  const { hasEditAccess } = useAuth()
  const { clients, loading: clientsLoading, selectedClientId, setSelectedClientId } = useClients()

  const [ruleTypes, setRuleTypes] = useState<RuleType[]>([])
  const [ruleTypeId, setRuleTypeId] = useState<string>('')
  const [targetClientId, setTargetClientId] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ParsedFilePreview | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set())
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)

  const requestedRuleType = searchParams.get('rule_type')
  const requestedClientId = searchParams.get('client_id')

  useEffect(() => { getRuleTypes().then(setRuleTypes) }, [])

  const accessibleClients = clients.filter(c => hasEditAccess(c.id))

  useEffect(() => {
    setTargetClientId(current => {
      if (requestedClientId && accessibleClients.some(c => c.id === requestedClientId)) {
        return requestedClientId
      }
      if (current && accessibleClients.some(c => c.id === current)) return current
      if (selectedClientId && accessibleClients.some(c => c.id === selectedClientId)) return selectedClientId
      return ''
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients, requestedClientId, selectedClientId])

  useEffect(() => {
    setRuleTypeId(current => {
      if (current && ruleTypes.some(ruleType => ruleType.id === current)) return current
      if (!requestedRuleType) return ''
      return ruleTypes.find(ruleType => ruleType.id === requestedRuleType || ruleType.slug === requestedRuleType)?.id ?? ''
    })
  }, [requestedRuleType, ruleTypes])

  useEffect(() => {
    const selectedRuleType = ruleTypes.find(rt => rt.id === ruleTypeId)
    if (!targetClientId || !selectedRuleType) {
      setExistingNames(new Set())
      return
    }
    getRules({ client_id: targetClientId, rule_type: selectedRuleType.slug })
      .then(rs => setExistingNames(new Set(rs.map((r: Rule) => r.name))))
      .catch(() => setExistingNames(new Set()))
  }, [targetClientId, ruleTypeId, ruleTypes])

  const onChoose = async (nextFile: File) => {
    setFile(nextFile)
    setParsing(true)
    setPreview(null)
    try {
      const parsed = await parseDrlFile(nextFile)
      setPreview(parsed)
      setSelected(new Set(parsed.rules.map(rule => rule.name)))
    } catch {
      toast('Parse failed', 'danger')
    } finally {
      setParsing(false)
    }
  }

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleAll = () => {
    if (!preview) return
    setSelected(prev => (
      prev.size === preview.rules.length
        ? new Set()
        : new Set(preview.rules.map(rule => rule.name))
    ))
  }

  const canEditTargetClient = targetClientId ? hasEditAccess(targetClientId) : false
  const canAttemptImport = !!preview && selected.size > 0 && !submitting
  const duplicates = useMemo(
    () => new Set(preview?.rules.filter(rule => existingNames.has(rule.name)).map(rule => rule.name) ?? []),
    [preview, existingNames],
  )

  const onConfirm = async () => {
    setAttemptedSubmit(true)

    if (!preview) {
      toast('Upload a DRL file to import', 'warn')
      return
    }
    if (!targetClientId) {
      toast('Select a client before importing', 'warn')
      return
    }
    if (!ruleTypeId) {
      toast('Select a rule type before importing', 'warn')
      return
    }
    if (selected.size === 0) {
      toast('Select at least one rule to import', 'warn')
      return
    }
    if (!canEditTargetClient) {
      toast('You can only import into clients you can edit', 'warn')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        rule_type_id: ruleTypeId,
        functions: preview.functions,
        imports: preview.imports,
        rules: preview.rules
          .filter(rule => selected.has(rule.name))
          .map(rule => ({
            client_id: targetClientId,
            rule_type_id: ruleTypeId,
            name: rule.name,
            condition_raw: rule.condition_raw,
            action_raw: rule.action_raw,
            required_function_names: rule.required_function_names ?? [],
            required_import_statements: rule.required_import_statements ?? [],
          })),
      }
      const result = await confirmImport(payload)
      toast(`Imported ${result.imported} rule(s)`, 'ok')
      setAttemptedSubmit(false)
      setFile(null)
      setPreview(null)
      setSelected(new Set())
    } catch {
      toast('Import failed', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  if (clientsLoading) {
    return <div className="page"><div className="empty">Loading...</div></div>
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
              <label>Client</label>
              <select
                className="select"
                value={targetClientId}
                aria-invalid={attemptedSubmit && !targetClientId}
                style={attemptedSubmit && !targetClientId ? { borderColor: 'var(--warn)' } : undefined}
                onChange={e => {
                  setTargetClientId(e.target.value)
                  setSelectedClientId(e.target.value || null)
                }}
              >
                <option value="">Choose client...</option>
                {accessibleClients.map(client => (
                  <option key={client.id} value={client.id}>{client.code} - {client.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Rule type</label>
              <select
                className="select"
                value={ruleTypeId}
                aria-invalid={attemptedSubmit && !ruleTypeId}
                style={attemptedSubmit && !ruleTypeId ? { borderColor: 'var(--warn)' } : undefined}
                onChange={e => setRuleTypeId(e.target.value)}
              >
                <option value="">Choose rule type...</option>
                {ruleTypes.map(rt => <option key={rt.id} value={rt.id}>{rt.name}</option>)}
              </select>
            </div>
          </div>
          {attemptedSubmit && (!targetClientId || !ruleTypeId) && (
            <div className="callout warn" style={{ marginTop: 12 }}>
              Choose both a client and a rule type before importing rules from the preview.
            </div>
          )}
          <div className="divider" />
          <div
            style={{
              border: '2px dashed var(--border-strong)',
              borderRadius: 10,
              padding: '32px 20px',
              textAlign: 'center',
              background: 'var(--bg-sunken)',
            }}
            onDragOver={event => { event.preventDefault() }}
            onDrop={event => {
              event.preventDefault()
              const droppedFile = event.dataTransfer.files[0]
              if (droppedFile) void onChoose(droppedFile)
            }}
          >
            <div
              style={{
                margin: '0 auto 10px',
                width: 40,
                height: 40,
                borderRadius: 10,
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon name="upload" size={20} />
            </div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Drop .drl file here</div>
            <div className="small muted" style={{ marginBottom: 12 }}>or click to choose</div>
            <label className="btn sm" style={{ cursor: 'pointer' }}>
              Choose file
              <input
                type="file"
                accept=".drl,.txt"
                hidden
                onChange={event => {
                  const nextFile = event.target.files?.[0]
                  if (nextFile) void onChoose(nextFile)
                }}
              />
            </label>
            {file && <div className="small muted" style={{ marginTop: 10 }}>{file.name}</div>}
          </div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div
            style={{
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600 }}>Preview</div>
            {preview && (
              <span className="tb-meta">{selected.size} of {preview.rules.length} selected</span>
            )}
          </div>
          {parsing ? (
            <div className="empty">Parsing...</div>
          ) : !preview ? (
            <EmptyState
              icon="upload"
              title="Upload to preview"
              body="Rules extracted from the DRL file will appear here."
            />
          ) : (
            <>
              <div
                style={{
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  gap: 16,
                  fontSize: 12.5,
                  color: 'var(--muted)',
                }}
              >
                <span>Package: <span className="mono">{preview.package}</span></span>
                <span>Functions: {preview.functions.length}</span>
                <span>Imports: {preview.imports.length}</span>
              </div>
              <table className="rules">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input
                        type="checkbox"
                        className="cbx"
                        checked={selected.size === preview.rules.length && preview.rules.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th>Rule name</th>
                    <th>Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rules.map(rule => (
                    <tr key={rule.name}>
                      <td className="col-check">
                        <input
                          type="checkbox"
                          className="cbx"
                          checked={selected.has(rule.name)}
                          onChange={() => toggle(rule.name)}
                        />
                      </td>
                      <td>
                        <div className="cell-name">{rule.name}</div>
                        {duplicates.has(rule.name) && (
                          <span className="badge warn" style={{ marginTop: 4 }}>
                            <Icon name="alertTri" size={11} /> already exists
                          </span>
                        )}
                      </td>
                      <td><div className="cell-cond">{rule.condition_raw || <span className="muted">-</span>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div
                style={{
                  padding: 12,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                }}
              >
                <button className="btn sm ghost" onClick={() => { setPreview(null); setFile(null) }}>Clear</button>
                <button className="btn sm accent" disabled={!canAttemptImport} onClick={onConfirm}>
                  {submitting ? 'Importing...' : `Import ${selected.size} rule(s)`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
