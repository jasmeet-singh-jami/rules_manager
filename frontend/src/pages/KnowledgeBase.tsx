import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useClients } from '../context/ClientContext'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icon'
import { SkeletonRows } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../components/Toast'
import {
  getKnowledgeDocs, uploadKnowledgeDoc, downloadKnowledgeDoc, deleteKnowledgeDoc, getKbCategories,
  type KnowledgeDocument, type KbCategory,
} from '../api/client'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeBase() {
  const { category = 'integrations' } = useParams<{ category: string }>()
  const { hasEditAccess } = useAuth()
  const { toast } = useToast()
  const { clients } = useClients()

  const [kbCategories, setKbCategories] = useState<KbCategory[]>([])
  const categoryLabel = kbCategories.find(c => c.slug === category)?.name ?? category
  const [docs, setDocs] = useState<KnowledgeDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ client_id: '', name: '', description: '' })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  useEffect(() => { getKbCategories().then(setKbCategories).catch(() => {}) }, [])

  useEffect(() => {
    let cancel = false
    setLoading(true)
    getKnowledgeDocs({ category, client_id: clientFilter || undefined })
      .then(d => { if (!cancel) setDocs(d) })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false) })
    return () => { cancel = true }
  }, [category, clientFilter])

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase()
    return ql
      ? docs.filter(d => d.name.toLowerCase().includes(ql) || d.filename.toLowerCase().includes(ql))
      : docs
  }, [docs, q])

  const editableClients = clients.filter(c => hasEditAccess(c.id))

  const openModal = () => {
    setForm({ client_id: editableClients[0]?.id ?? '', name: '', description: '' })
    setFile(null)
    setFormError('')
    setShowModal(true)
  }

  const handleUpload = async () => {
    if (!form.client_id) { setFormError('Select a client'); return }
    if (!form.name.trim()) { setFormError('Name is required'); return }
    if (!form.description.trim()) { setFormError('Description is required'); return }
    if (!file) { setFormError('Select a file'); return }
    setSaving(true)
    setFormError('')
    try {
      const doc = await uploadKnowledgeDoc({
        client_id: form.client_id,
        category,
        name: form.name.trim(),
        description: form.description.trim(),
        file,
      })
      setDocs(prev => [doc, ...prev])
      toast('Document uploaded', 'ok')
      setShowModal(false)
    } catch {
      setFormError('Upload failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDownload = async (doc: KnowledgeDocument) => {
    setDownloading(doc.id)
    try {
      const res = await downloadKnowledgeDoc(doc.id)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.filename
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
      await deleteKnowledgeDoc(id)
      setDocs(prev => prev.filter(d => d.id !== id))
      toast('Document deleted', 'ok')
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
          <h1 className="page-title">Knowledge Base · {categoryLabel}</h1>
          <div className="page-sub">Client knowledge documents</div>
        </div>
        {editableClients.length > 0 && (
          <div className="page-actions">
            <button className="btn accent" onClick={openModal}>
              <Icon name="upload" /> Upload Document
            </button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <div className="tb-input">
          <Icon name="search" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search documents…" />
        </div>
        <select className="select" value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
        </select>
        <div className="tb-spacer" />
        <span className="tb-meta">{filtered.length} documents</span>
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
                  <EmptyState icon="folder" title="No documents yet" body="Upload a document to get started." />
                </td></tr>
              ) : filtered.map(doc => {
                const client = clients.find(c => c.id === doc.client_id)
                return (
                <tr key={doc.id}>
                  <td>
                    <span className="cell-name">{doc.name}</span>
                    <div className="small muted">{doc.description}</div>
                  </td>
                  <td className="small">{client ? <><strong>{client.code}</strong> <span className="muted">— {client.name}</span></> : doc.client_id}</td>
                  <td className="small">{doc.filename}</td>
                  <td className="small muted">{formatBytes(doc.file_size)}</td>
                  <td><span className="muted small">{new Date(doc.created_at).toLocaleString()}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn ghost"
                        onClick={() => handleDownload(doc)}
                        disabled={downloading === doc.id}
                        title="Download"
                      >
                        <Icon name="download" />
                      </button>
                      {hasEditAccess(doc.client_id) && (
                        confirmDelete === doc.id ? (
                          <>
                            <button className="btn accent" onClick={() => handleDelete(doc.id)}>Confirm</button>
                            <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn ghost" onClick={() => setConfirmDelete(doc.id)} title="Delete">
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
            <h2>Upload Document</h2>
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
                placeholder="Document title"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>Description</label>
              <input
                type="text"
                placeholder="What does this document cover?"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="field" style={{ marginBottom: 20 }}>
              <label>File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn accent" onClick={handleUpload} disabled={saving}>
                {saving ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
