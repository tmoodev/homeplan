import { useState } from 'react'
import api from '../api/client'

interface Props {
  projectId: string
  confirmedAPCount: number
}

export default function HandoffPanel({ projectId, confirmedAPCount }: Props) {
  const [generating, setGenerating] = useState(false)
  const [hasPackage, setHasPackage] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    if (confirmedAPCount === 0) {
      setError('Confirm at least one AP before generating a package.')
      return
    }
    setError('')
    setGenerating(true)
    try {
      await api.post(`/projects/${projectId}/package`)
      setHasPackage(true)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Generation failed.'
      setError(msg)
    } finally {
      setGenerating(false)
    }
  }

  function downloadUrl(type: string) {
    return `/api/projects/${projectId}/package/${type}`
  }

  return (
    <div>
      {error && <div className="alert alert-error" style={{ fontSize: '0.8rem', marginBottom: 10 }}>{error}</div>}

      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
        {confirmedAPCount} confirmed AP{confirmedAPCount !== 1 ? 's' : ''}
      </div>

      <button
        className="btn btn-primary btn-full"
        disabled={generating || confirmedAPCount === 0}
        onClick={generate}
        style={{ marginBottom: 10 }}
      >
        {generating ? (
          <><span className="spinner-white" style={{ marginRight: 6 }} />Generating (may take ~30s)…</>
        ) : (
          'Generate Handoff Package'
        )}
      </button>

      {hasPackage && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <a
            href={downloadUrl('annotated-pdf')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-full btn-sm"
          >
            Download Annotated Plan PDF
          </a>
          <a
            href={downloadUrl('bom-csv')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-full btn-sm"
          >
            Download BOM CSV
          </a>
          <a
            href={downloadUrl('contractor-pdf')}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary btn-full btn-sm"
          >
            Download Contractor Summary PDF
          </a>
        </div>
      )}
    </div>
  )
}
