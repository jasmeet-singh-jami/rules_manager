import { useEffect, useState } from 'react'
import {
  type KbCategory, type ScriptCategory, type RuleType,
  getKbCategories, createKbCategory, updateKbCategory, deleteKbCategory, reorderKbCategories,
  getScriptCategories, createScriptCategory, updateScriptCategory, deleteScriptCategory, reorderScriptCategories,
  getRuleTypes, createRuleType, updateRuleType, deleteRuleType, reorderRuleTypes,
} from '../../api/client'
import { useToast } from '../Toast'
import { Icon } from '../Icon'
import { useClients } from '../../context/ClientContext'

const SLUG_RE = /^[a-z0-9-]+$/
const FILE_EXT_RE = /^\.[A-Za-z0-9]{1,10}$/

function parseError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const match = msg.match(/^(\d+):\s*(.*)$/)
  if (match) {
    try {
      const detail = JSON.parse(match[2]).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
    } catch { /* fall through */ }
    return match[2]
  }
  return msg
}

// ── KB sub-panel ─────────────────────────────────────────────────────────────

export function KbCategoriesPanel() {
  const { toast } = useToast()
  const { bumpCategoriesVersion } = useClients()
  const [cats, setCats] = useState<KbCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [adding, setAdding] = useState(false)
  const [newSlug, setNewSlug] = useState('')
  const [newName, setNewName] = useState('')
  const [deletingFor, setDeletingFor] = useState<KbCategory | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('')

  const refresh = async () => {
    const fresh = await getKbCategories()
    setCats(fresh)
  }

  useEffect(() => {
    getKbCategories().then(setCats).catch(() => toast('Failed to load KB categories', 'danger')).finally(() => setLoading(false))
  }, [toast])

  const onAdd = async () => {
    const slug = newSlug.trim()
    const name = newName.trim()
    if (!slug || !name) return
    if (!SLUG_RE.test(slug)) { toast('Slug must be lowercase letters/digits/hyphens', 'danger'); return }
    try {
      const cat = await createKbCategory({ slug, name })
      setCats(prev => [...prev, cat].sort((a, b) => a.sort_order - b.sort_order))
      setNewSlug(''); setNewName(''); setAdding(false)
      bumpCategoriesVersion()
      toast(`Added '${cat.name}'`, 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onSaveEdit = async (cat: KbCategory) => {
    const name = editName.trim()
    if (!name || name === cat.name) { setEditingId(null); return }
    try {
      const updated = await updateKbCategory(cat.id, { name })
      setCats(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditingId(null)
      bumpCategoriesVersion()
      toast(`Renamed to '${updated.name}'`, 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onMove = async (cat: KbCategory, direction: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(c => c.id === cat.id)
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const other = sorted[targetIdx]
    try {
      await reorderKbCategories([
        { id: cat.id, sort_order: other.sort_order },
        { id: other.id, sort_order: cat.sort_order },
      ])
      await refresh()
      bumpCategoriesVersion()
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onConfirmDelete = async () => {
    if (!deletingFor) return
    const target = reassignTo || undefined
    try {
      await deleteKbCategory(deletingFor.id, target)
      setCats(prev => prev.filter(c => c.id !== deletingFor.id))
      setDeletingFor(null); setReassignTo('')
      bumpCategoriesVersion()
      toast('Category deleted', 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  if (loading) return <p className="muted" style={{ margin: 0 }}>Loading...</p>

  const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <table className="rules">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Order</th>
            <th>Slug</th>
            <th>Name</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat, idx) => (
            <tr key={cat.id}>
              <td>
                <span className="hstack" style={{ gap: 4 }}>
                  <button className="btn sm ghost" disabled={idx === 0} onClick={() => onMove(cat, -1)} title="Move up">
                    <Icon name="arrowUp" />
                  </button>
                  <button className="btn sm ghost" disabled={idx === sorted.length - 1} onClick={() => onMove(cat, 1)} title="Move down">
                    <Icon name="arrowDown" />
                  </button>
                </span>
              </td>
              <td><span className="mono small muted">{cat.slug}</span></td>
              <td>
                {editingId === cat.id ? (
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onSaveEdit(cat); if (e.key === 'Escape') setEditingId(null) }}
                    onBlur={() => onSaveEdit(cat)}
                  />
                ) : (
                  <span>{cat.name}</span>
                )}
              </td>
              <td className="col-actions">
                <span className="hstack" style={{ gap: 4 }}>
                  {editingId === cat.id ? null : (
                    <button className="btn sm ghost" onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}>
                      Edit
                    </button>
                  )}
                  <button className="btn sm danger-ghost" onClick={() => { setDeletingFor(cat); setReassignTo('') }}>
                    Delete
                  </button>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding ? (
        <div className="hstack" style={{ gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <input
            placeholder="slug (lowercase, hyphens)"
            value={newSlug}
            onChange={e => setNewSlug(e.target.value)}
            style={{ width: 180 }}
          />
          <input
            placeholder="Display name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{ flex: 1 }}
          />
          <button className="btn sm accent" onClick={onAdd}>Create</button>
          <button className="btn sm ghost" onClick={() => { setAdding(false); setNewSlug(''); setNewName('') }}>Cancel</button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn sm ghost" onClick={() => setAdding(true)}>+ Add category</button>
        </div>
      )}

      {deletingFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'grid', placeItems: 'center', zIndex: 300 }}>
          <div className="card" style={{ width: 420 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Delete '{deletingFor.name}'?
            </div>
            <p className="muted small" style={{ marginTop: 0 }}>
              If documents reference this category, you must reassign them first.
            </p>
            <div className="field">
              <label>Reassign documents to</label>
              <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                <option value="">(don't reassign — only works if no documents)</option>
                {sorted.filter(c => c.id !== deletingFor.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>
                ))}
              </select>
            </div>
            <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
              <button className="btn sm ghost" onClick={() => { setDeletingFor(null); setReassignTo('') }}>Cancel</button>
              <button className="btn sm danger" onClick={onConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Script sub-panel ─────────────────────────────────────────────────────────

export function ScriptCategoriesPanel() {
  const { toast } = useToast()
  const { bumpCategoriesVersion } = useClients()
  const [cats, setCats] = useState<ScriptCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; file_extension: string; mime_type: string }>({ name: '', file_extension: '', mime_type: '' })
  const [adding, setAdding] = useState(false)
  const [newCat, setNewCat] = useState({ slug: '', name: '', file_extension: '', mime_type: '' })
  const [deletingFor, setDeletingFor] = useState<ScriptCategory | null>(null)
  const [reassignTo, setReassignTo] = useState<string>('')

  const refresh = async () => {
    const fresh = await getScriptCategories()
    setCats(fresh)
  }

  useEffect(() => {
    getScriptCategories().then(setCats).catch(() => toast('Failed to load script categories', 'danger')).finally(() => setLoading(false))
  }, [toast])

  const onAdd = async () => {
    const slug = newCat.slug.trim()
    const name = newCat.name.trim()
    const ext = newCat.file_extension.trim()
    const mime = newCat.mime_type.trim()
    if (!slug || !name || !ext || !mime) return
    if (!SLUG_RE.test(slug)) { toast('Slug must be lowercase letters/digits/hyphens', 'danger'); return }
    if (!FILE_EXT_RE.test(ext)) { toast('File extension must start with "."', 'danger'); return }
    try {
      const cat = await createScriptCategory({ slug, name, file_extension: ext, mime_type: mime })
      setCats(prev => [...prev, cat].sort((a, b) => a.sort_order - b.sort_order))
      setNewCat({ slug: '', name: '', file_extension: '', mime_type: '' })
      setAdding(false)
      bumpCategoriesVersion()
      toast(`Added '${cat.name}'`, 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onSaveEdit = async (cat: ScriptCategory) => {
    const name = editForm.name.trim()
    const ext = editForm.file_extension.trim()
    const mime = editForm.mime_type.trim()
    if (!name || !ext || !mime) { setEditingId(null); return }
    if (!FILE_EXT_RE.test(ext)) { toast('File extension must start with "."', 'danger'); return }
    if (name === cat.name && ext === cat.file_extension && mime === cat.mime_type) {
      setEditingId(null)
      return
    }
    try {
      const updated = await updateScriptCategory(cat.id, { name, file_extension: ext, mime_type: mime })
      setCats(prev => prev.map(c => c.id === updated.id ? updated : c))
      setEditingId(null)
      bumpCategoriesVersion()
      toast(`Updated '${updated.name}'`, 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onMove = async (cat: ScriptCategory, direction: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(c => c.id === cat.id)
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const other = sorted[targetIdx]
    try {
      await reorderScriptCategories([
        { id: cat.id, sort_order: other.sort_order },
        { id: other.id, sort_order: cat.sort_order },
      ])
      await refresh()
      bumpCategoriesVersion()
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onConfirmDelete = async () => {
    if (!deletingFor) return
    const target = reassignTo || undefined
    try {
      await deleteScriptCategory(deletingFor.id, target)
      setCats(prev => prev.filter(c => c.id !== deletingFor.id))
      setDeletingFor(null); setReassignTo('')
      bumpCategoriesVersion()
      toast('Category deleted', 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  if (loading) return <p className="muted" style={{ margin: 0 }}>Loading...</p>

  const sorted = [...cats].sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div>
      <table className="rules">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Order</th>
            <th>Slug</th>
            <th>Name</th>
            <th>Ext</th>
            <th>MIME</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((cat, idx) => {
            const isEditing = editingId === cat.id
            return (
              <tr key={cat.id}>
                <td>
                  <span className="hstack" style={{ gap: 4 }}>
                    <button className="btn sm ghost" disabled={idx === 0} onClick={() => onMove(cat, -1)} title="Move up">
                      <Icon name="arrowUp" />
                    </button>
                    <button className="btn sm ghost" disabled={idx === sorted.length - 1} onClick={() => onMove(cat, 1)} title="Move down">
                      <Icon name="arrowDown" />
                    </button>
                  </span>
                </td>
                <td><span className="mono small muted">{cat.slug}</span></td>
                <td>
                  {isEditing ? (
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  ) : cat.name}
                </td>
                <td>
                  {isEditing ? (
                    <input value={editForm.file_extension} onChange={e => setEditForm(f => ({ ...f, file_extension: e.target.value }))} style={{ width: 80 }} />
                  ) : <span className="mono small">{cat.file_extension}</span>}
                </td>
                <td>
                  {isEditing ? (
                    <input value={editForm.mime_type} onChange={e => setEditForm(f => ({ ...f, mime_type: e.target.value }))} />
                  ) : <span className="mono small muted">{cat.mime_type}</span>}
                </td>
                <td className="col-actions">
                  <span className="hstack" style={{ gap: 4 }}>
                    {isEditing ? (
                      <>
                        <button className="btn sm accent" onClick={() => onSaveEdit(cat)}>Save</button>
                        <button className="btn sm ghost" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn sm ghost"
                          onClick={() => { setEditingId(cat.id); setEditForm({ name: cat.name, file_extension: cat.file_extension, mime_type: cat.mime_type }) }}
                        >
                          Edit
                        </button>
                        <button className="btn sm danger-ghost" onClick={() => { setDeletingFor(cat); setReassignTo('') }}>
                          Delete
                        </button>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {adding ? (
        <div className="hstack" style={{ gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <input placeholder="slug" value={newCat.slug} onChange={e => setNewCat(p => ({ ...p, slug: e.target.value }))} style={{ width: 140 }} />
          <input placeholder="Display name" value={newCat.name} onChange={e => setNewCat(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 160 }} />
          <input placeholder=".sh" value={newCat.file_extension} onChange={e => setNewCat(p => ({ ...p, file_extension: e.target.value }))} style={{ width: 80 }} />
          <input placeholder="text/plain" value={newCat.mime_type} onChange={e => setNewCat(p => ({ ...p, mime_type: e.target.value }))} style={{ width: 160 }} />
          <button className="btn sm accent" onClick={onAdd}>Create</button>
          <button className="btn sm ghost" onClick={() => { setAdding(false); setNewCat({ slug: '', name: '', file_extension: '', mime_type: '' }) }}>Cancel</button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn sm ghost" onClick={() => setAdding(true)}>+ Add category</button>
        </div>
      )}

      {deletingFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'grid', placeItems: 'center', zIndex: 300 }}>
          <div className="card" style={{ width: 420 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Delete '{deletingFor.name}'?
            </div>
            <p className="muted small" style={{ marginTop: 0 }}>
              If cron jobs reference this category, you must reassign them first.
            </p>
            <div className="field">
              <label>Reassign cron jobs to</label>
              <select value={reassignTo} onChange={e => setReassignTo(e.target.value)}>
                <option value="">(don't reassign — only works if no cron jobs)</option>
                {sorted.filter(c => c.id !== deletingFor.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.slug})</option>
                ))}
              </select>
            </div>
            <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
              <button className="btn sm ghost" onClick={() => { setDeletingFor(null); setReassignTo('') }}>Cancel</button>
              <button className="btn sm danger" onClick={onConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Rule Types sub-panel ─────────────────────────────────────────────────────

export function RuleTypesPanel() {
  const { toast } = useToast()
  const { bumpCategoriesVersion } = useClients()
  const [rts, setRts] = useState<RuleType[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; pipeline_stage: string }>({ name: '', pipeline_stage: '' })
  const [adding, setAdding] = useState(false)
  const [newRt, setNewRt] = useState({ slug: '', name: '', drl_package: '' })
  const [deletingFor, setDeletingFor] = useState<RuleType | null>(null)

  const refresh = async () => {
    const fresh = await getRuleTypes()
    setRts(fresh)
  }

  useEffect(() => {
    getRuleTypes().then(setRts).catch(() => toast('Failed to load rule types', 'danger')).finally(() => setLoading(false))
  }, [toast])

  const onAdd = async () => {
    const slug = newRt.slug.trim()
    const name = newRt.name.trim()
    const pkg = newRt.drl_package.trim()
    if (!slug || !name || !pkg) return
    if (!SLUG_RE.test(slug)) { toast('Slug must be lowercase letters/digits/hyphens', 'danger'); return }
    try {
      const rt = await createRuleType({ slug, name, drl_package: pkg })
      setRts(prev => [...prev, rt].sort((a, b) => a.pipeline_stage - b.pipeline_stage))
      setNewRt({ slug: '', name: '', drl_package: '' })
      setAdding(false)
      bumpCategoriesVersion()
      toast(`Added '${rt.name}'`, 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onSaveEdit = async (rt: RuleType) => {
    const name = editForm.name.trim()
    const stageNum = parseInt(editForm.pipeline_stage, 10)
    if (!name || Number.isNaN(stageNum)) { setEditingId(null); return }
    if (name === rt.name && stageNum === rt.pipeline_stage) {
      setEditingId(null)
      return
    }
    try {
      const updated = await updateRuleType(rt.id, { name, pipeline_stage: stageNum })
      setRts(prev => prev.map(r => r.id === updated.id ? updated : r))
      setEditingId(null)
      bumpCategoriesVersion()
      toast(`Updated '${updated.name}'`, 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onMove = async (rt: RuleType, direction: -1 | 1) => {
    const sorted = [...rts].sort((a, b) => a.pipeline_stage - b.pipeline_stage)
    const idx = sorted.findIndex(r => r.id === rt.id)
    const targetIdx = idx + direction
    if (targetIdx < 0 || targetIdx >= sorted.length) return
    const other = sorted[targetIdx]
    try {
      await reorderRuleTypes([
        { id: rt.id, pipeline_stage: other.pipeline_stage },
        { id: other.id, pipeline_stage: rt.pipeline_stage },
      ])
      await refresh()
      bumpCategoriesVersion()
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  const onConfirmDelete = async () => {
    if (!deletingFor) return
    try {
      await deleteRuleType(deletingFor.id)
      setRts(prev => prev.filter(r => r.id !== deletingFor.id))
      setDeletingFor(null)
      bumpCategoriesVersion()
      toast('Rule type deleted', 'ok')
    } catch (e) {
      toast(parseError(e), 'danger')
    }
  }

  if (loading) return <p className="muted" style={{ margin: 0 }}>Loading...</p>

  const sorted = [...rts].sort((a, b) => a.pipeline_stage - b.pipeline_stage)

  return (
    <div>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
        <span className="muted">
          Reordering changes the pipeline stage; system-locked types are seeded and cannot be deleted.
        </span>
      </div>
      <table className="rules">
        <thead>
          <tr>
            <th style={{ width: 80 }}>Order</th>
            <th>Slug</th>
            <th>Name</th>
            <th style={{ width: 90 }}>Stage</th>
            <th>DRL package</th>
            <th className="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((rt, idx) => {
            const isEditing = editingId === rt.id
            return (
              <tr key={rt.id}>
                <td>
                  <span className="hstack" style={{ gap: 4 }}>
                    <button className="btn sm ghost" disabled={idx === 0} onClick={() => onMove(rt, -1)} title="Move up">
                      <Icon name="arrowUp" />
                    </button>
                    <button className="btn sm ghost" disabled={idx === sorted.length - 1} onClick={() => onMove(rt, 1)} title="Move down">
                      <Icon name="arrowDown" />
                    </button>
                  </span>
                </td>
                <td>
                  <span className="mono small muted">{rt.slug}</span>
                  {rt.is_system_locked && (
                    <span className="badge neutral" style={{ marginLeft: 6 }}>system</span>
                  )}
                </td>
                <td>
                  {isEditing ? (
                    <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                  ) : rt.name}
                </td>
                <td>
                  {isEditing ? (
                    <input
                      type="number"
                      value={editForm.pipeline_stage}
                      onChange={e => setEditForm(f => ({ ...f, pipeline_stage: e.target.value }))}
                      style={{ width: 70 }}
                    />
                  ) : <span className="mono">{rt.pipeline_stage}</span>}
                </td>
                <td><span className="mono small muted">{rt.drl_package}</span></td>
                <td className="col-actions">
                  <span className="hstack" style={{ gap: 4 }}>
                    {isEditing ? (
                      <>
                        <button className="btn sm accent" onClick={() => onSaveEdit(rt)}>Save</button>
                        <button className="btn sm ghost" onClick={() => setEditingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn sm ghost"
                          onClick={() => { setEditingId(rt.id); setEditForm({ name: rt.name, pipeline_stage: String(rt.pipeline_stage) }) }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn sm danger-ghost"
                          disabled={rt.is_system_locked}
                          title={rt.is_system_locked ? 'System-locked rule type cannot be deleted' : 'Delete'}
                          onClick={() => setDeletingFor(rt)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {adding ? (
        <div className="hstack" style={{ gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <input placeholder="slug" value={newRt.slug} onChange={e => setNewRt(p => ({ ...p, slug: e.target.value }))} style={{ width: 160 }} />
          <input placeholder="Display name" value={newRt.name} onChange={e => setNewRt(p => ({ ...p, name: e.target.value }))} style={{ flex: 1, minWidth: 160 }} />
          <input placeholder="com.example.drl" value={newRt.drl_package} onChange={e => setNewRt(p => ({ ...p, drl_package: e.target.value }))} style={{ flex: 1, minWidth: 200 }} />
          <button className="btn sm accent" onClick={onAdd}>Create</button>
          <button className="btn sm ghost" onClick={() => { setAdding(false); setNewRt({ slug: '', name: '', drl_package: '' }) }}>Cancel</button>
        </div>
      ) : (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn sm ghost" onClick={() => setAdding(true)}>+ Add rule type</button>
        </div>
      )}

      {deletingFor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
                      display: 'grid', placeItems: 'center', zIndex: 300 }}>
          <div className="card" style={{ width: 420 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Delete '{deletingFor.name}'?
            </div>
            <p className="muted small" style={{ marginTop: 0 }}>
              This rule type will be permanently removed. Any rules attached to it must be deleted or migrated first.
            </p>
            <div className="hstack" style={{ justifyContent: 'flex-end', marginTop: 12, gap: 8 }}>
              <button className="btn sm ghost" onClick={() => setDeletingFor(null)}>Cancel</button>
              <button className="btn sm danger" onClick={onConfirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
