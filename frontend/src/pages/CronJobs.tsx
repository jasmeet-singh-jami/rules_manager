import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import {
  getCronJobs, uploadCronJob, downloadCronJob, deleteCronJob, getScriptCategories,
  type CronJob, type ScriptCategory,
} from '../api/client'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function CronJobs() {
  const { category = 'shell' } = useParams<{ category: string }>()
  const [scriptCategories, setScriptCategories] = useState<ScriptCategory[]>([])
  const categoryLabel = scriptCategories.find(c => c.slug === category)?.name ?? category
  const { hasEditAccess } = useAuth()
  const { toast } = useToast()
  const { clients } = useClients()

  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ client_id: '', name: '', description: '', script: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { getScriptCategories().then(setScriptCategories).catch(() => {}) }, [])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getCronJobs(clientFilter || undefined, category)
      .then(j => { if (!cancel) setJobs(j) })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [clientFilter, category])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return ql
      ? jobs.filter(j => j.name.toLowerCase().includes(ql) || j.filename.toLowerCase().includes(ql))
      : jobs
  }, [jobs, q])

  const editableClients = clients.filter(c => hasEditAccess(c.id))

  const openModal = () => {
    setForm({ client_id: editableClients[0]?.id ?? '', name: '', description: '', script: '' })
    setFormError('')
    setShowModal(true)
  }

  const handleUpload = async () => {
    if (!form.client_id) { setFormError('Select a client'); return }
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.description.trim()) { setFormError('Description is required'); return }
    if (!form.script.trim()) { setFormError('Script is required'); return }
    setSaving(true)
    setFormError('')
    try {
      const job = await uploadCronJob({
        client_id: form.client_id,
        name: form.name.trim(),
        description: form.description.trim(),
        script: form.script,
        script_type: category,
      })
      setJobs(prev => [job, ...prev])
      toast('Script saved', 'ok')
      setShowModal(false)
    } catch {
      setFormError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async (job: CronJob) => {
    setDownloading(job.id)
    try {
      const res = await downloadCronJob(job.id)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = job.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast('Download failed', 'danger')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCronJob(id)
      setJobs(prev => prev.filter(j => j.id !== id))
      toast('Script deleted', 'ok')
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
          <h1 className="page-title">Scripts — {categoryLabel}</h1>
          <div className="page-sub">Client automation scripts</div>
        </div>
        {editableClients.length > 0 && (
          <div className="page-actions">
            <button className="btn accent" onClick={openModal}>
              <Icon name="plus" /> Add Script
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search scripts…" />
        </div>
        <select className="select" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} scripts</span>
      </div>

      <div className="table-wrap">
        <table className="rules">
          <thead>
            <tr>
              <th>Name</th>
              <th>Client</th>
              <th>Filename</th>
              <th>Size</th>
              <th className="col-updated">Uploaded</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <SkeletonRows count={4} cols={6} /> :
              filtered.length === 0 ? (
                <tr><td colSpan={6}>
                  <EmptyState icon="clock" title={`No ${categoryLabel} scripts yet`} body="Upload a script to get started." />
                </td></tr>
              ) : filtered.map(job => {
                const client = clients.find(c => c.id === job.client_id)
                return (
                <tr key={job.id}>
                  <td>
                    <span className="cell-name">{job.name}</span>
                    <div className="small muted">{job.description}</div>
                  </td>
                  <td className="small">{client ? <><strong>{client.code}</strong> <span className="muted">— {client.name}</span></> : job.client_id}</td>
                  <td className="small">{job.filename}</td>
                  <td className="small muted">{formatBytes(job.file_size)}</td>
                  <td><span className="muted small">{new Date(job.created_at).toLocaleString()}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn ghost"
                        onClick={() => handleDownload(job)}
                        disabled={downloading === job.id}
                        title="Download"
                      >
                        <Icon name="download" />
                      </button>
                      {hasEditAccess(job.client_id) && (
                        confirmDelete === job.id ? (
                          <>
                            <button className="btn accent" onClick={() => handleDelete(job.id)}>Confirm</button>
                            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn ghost" onClick={() => setConfirmDelete(job.id)} title="Delete">
                            <Icon name="trash" />
                          </button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              )})}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Add {categoryLabel} Script</h2>
            {formError && <div className="callout danger small" style={{ marginBottom: 14 }}>{formError}</div>}
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Client</label>
              <select
                className="select"
                value={form.client_id}
                onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              >
                <option value="">Select client…</option>
                {editableClients.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Name</label>
              <input
                type="text"
                placeholder="e.g. Nightly Data Sync"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description</label>
              <input
                type="text"
                placeholder="What does this script do?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>Script</label>
              <textarea
                rows={10}
                placeholder={`Paste your ${categoryLabel} script here…`}
                value={form.script}
                onChange={e => setForm(f => ({ ...f, script: e.target.value }))}
                style={{ fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn accent" onClick={handleUpload} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
