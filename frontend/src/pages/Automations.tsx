import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../components/Icon'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import {
  getAutomations, downloadAutomationTemplate, uploadAutomations, createAutomation, deleteAutomation,
  type Automation,
} from '../api/client'

export function Automations() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [automations, setAutomations] = useState<Automation[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [subCategoryFilter, setSubCategoryFilter] = useState('')
  const [uploading, setUploading] = useState(false)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ category: '', sub_category: '', script_name: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = () => {
    setLoading(true)
    getAutomations()
      .then(setAutomations)
      .catch(() => toast('Failed to load automations', 'danger'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() =>
    [...new Set(automations.map(a => a.category))].sort(),
    [automations]
  )

  const subCategories = useMemo(() => {
    const src = categoryFilter
      ? automations.filter(a => a.category === categoryFilter)
      : automations
    return [...new Set(src.map(a => a.sub_category).filter(Boolean))].sort()
  }, [automations, categoryFilter])

  const filtered = useMemo(() => {
    let list = automations
    if (categoryFilter) list = list.filter(a => a.category === categoryFilter)
    if (subCategoryFilter) list = list.filter(a => a.sub_category === subCategoryFilter)
    if (q.trim()) {
      const ql = q.trim().toLowerCase()
      list = list.filter(a =>
        a.script_name.toLowerCase().includes(ql) ||
        (a.description ?? '').toLowerCase().includes(ql)
      )
    }
    return list
  }, [automations, categoryFilter, subCategoryFilter, q])

  const handleCategoryChange = (val: string) => {
    setCategoryFilter(val)
    setSubCategoryFilter('')
  }

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true)
    try {
      const res = await downloadAutomationTemplate()
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'automations_template.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'danger')
    } finally {
      setDownloadingTemplate(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const imported = await uploadAutomations(file)
      setAutomations(prev => [...imported, ...prev])
      toast(`Imported ${imported.length} automation${imported.length !== 1 ? 's' : ''}`, 'ok')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      toast(msg.length < 120 ? msg : 'Upload failed', 'danger')
    } finally {
      setUploading(false)
    }
  }

  const openModal = () => {
    setForm({ category: '', sub_category: '', script_name: '', description: '' })
    setFormError('')
    setShowModal(true)
  }

  const handleCreate = async () => {
    if (!form.category.trim()) { setFormError('Category is required'); return }
    if (!form.script_name.trim()) { setFormError('Script Name is required'); return }
    setSaving(true)
    setFormError('')
    try {
      const created = await createAutomation({
        category: form.category.trim(),
        sub_category: form.sub_category.trim(),
        script_name: form.script_name.trim(),
        description: form.description.trim() || undefined,
      })
      setAutomations(prev => [created, ...prev])
      toast('Entry added', 'ok')
      setShowModal(false)
    } catch {
      setFormError('Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAutomation(id)
      setAutomations(prev => prev.filter(a => a.id !== id))
      toast('Deleted', 'ok')
    } catch {
      toast('Delete failed', 'danger')
    } finally {
      setConfirmDelete(null)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Automations</h1>
          <div className="page-sub">Automation use-case catalogue</div>
        </div>
        <div className="page-actions">
          <button
            className="btn ghost"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            title="Download Excel template"
          >
            <Icon name="download" />
            {downloadingTemplate ? 'Downloading…' : 'Template'}
          </button>
          <button
            className="btn ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Icon name="upload" />
            {uploading ? 'Uploading…' : 'Upload Excel'}
          </button>
          <button className="btn accent" onClick={openModal}>
            <Icon name="plus" /> Add Entry
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search script name or description…"
          />
        </div>
        <select
          className="select"
          value={categoryFilter}
          onChange={e => handleCategoryChange(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          className="select"
          value={subCategoryFilter}
          onChange={e => setSubCategoryFilter(e.target.value)}
          disabled={subCategories.length === 0}
        >
          <option value="">All sub-categories</option>
          {subCategories.map(sc => <option key={sc} value={sc}>{sc}</option>)}
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th>Category</th>
              <th>Sub-Category</th>
              <th>Script Name</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={5} cols={6} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={5}>
                  <EmptyState
                    icon="zap"
                    title="No automations yet"
                    body="Download the template, fill it in, then upload the Excel file."
                  />
                </td></tr>
              ) : filtered.map(a => (
                <tr key={a.id}>
                  <td>
                    <span className="cell-name">{a.category}</span>
                  </td>
                  <td className="small">{a.sub_category}</td>
                  <td>
                    <span className="cell-name">{a.script_name}</span>
                  </td>
                  <td className="small muted">{a.description ?? '—'}</td>
                  <td>
                    {confirmDelete === a.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn accent" onClick={() => handleDelete(a.id)}>Confirm</button>
                        <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        className="btn ghost"
                        onClick={() => setConfirmDelete(a.id)}
                        title="Delete"
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add Automation Entry</h2>
            {formError && <div className="callout danger small" style={{ marginBottom: 14 }}>{formError}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Category <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. COMPUTE"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Sub-Category</label>
              <input
                type="text"
                placeholder="e.g. UserManagement"
                value={form.sub_category}
                onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Script Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text"
                placeholder="e.g. COMPUTE_POWERSHELL_ADD-USER-IN-DL"
                value={form.script_name}
                onChange={e => setForm(f => ({ ...f, script_name: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Description</label>
              <textarea
                rows={3}
                placeholder="What does this automation do?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn accent" onClick={handleCreate} disabled={saving}>
                {saving ? 'Saving…' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
