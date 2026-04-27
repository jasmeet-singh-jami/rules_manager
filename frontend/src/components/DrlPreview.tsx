import { useMemo } from 'react'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { tokenize, type Token } from './DrlPreview/highlight'

interface DrlPreviewProps {
  text: string
  filename?: string
  showCopy?: boolean
}

function renderTokens(tokens: Token[]) {
  return tokens.map((t, i) =>
    t.kind === 'ws' || t.kind === 'sym'
      ? <span key={i}>{t.text}</span>
      : <span key={i} className={`tok-${t.kind}`}>{t.text}</span>
  )
}

export function DrlPreview({ text, filename = 'rule.drl', showCopy = true }: DrlPreviewProps) {
  const tokens = useMemo(() => tokenize(text), [text])
  const lineCount = text.split('\n').length
  const { toast } = useToast()

  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
      } else {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none'
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      toast('Copied DRL', 'ok')
    } catch {
      toast('Copy failed', 'warn')
    }
  }

  return (
    <div className="editor-side" style={{ display: 'flex', flexDirection: 'column', minHeight: 260 }}>
      <div className="code-head">
        <div className="code-head-title">
          <span className="code-dots"><span /><span /><span /></span>
          <span>{filename}</span>
        </div>
        {showCopy && (
          <button className="btn icon sm ghost" title="Copy DRL" onClick={copy}>
            <Icon name="copy" />
          </button>
        )}
      </div>
      <div className="code-body">
        <pre className="code-pre">
          <span className="code-ln">
            {Array.from({ length: lineCount }, (_, i) => (i + 1) + '\n')}
          </span>
          <code className="code-src">{renderTokens(tokens)}</code>
        </pre>
      </div>
    </div>
  )
}
