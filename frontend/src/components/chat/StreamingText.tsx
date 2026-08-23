import { useEffect, useState } from 'react'
import { MarkdownResponse } from '../common/MarkdownResponse'
import type { Citation } from '../../types/chat'

interface StreamingTextProps {
  content: string
  citations?: Citation[]
  onCitationClick?: (citation: Citation) => void
  onComplete?: () => void
}

export function StreamingText({ content, citations, onCitationClick, onComplete }: StreamingTextProps) {
  const [displayed, setDisplayed] = useState('')

  useEffect(() => {
    let index = 0
    const step = Math.max(1, Math.floor(content.length / 100))

    const interval = setInterval(() => {
      index += step
      if (index >= content.length) {
        setDisplayed(content)
        clearInterval(interval)
        onComplete?.()
      } else {
        setDisplayed(content.slice(0, index))
      }
    }, 15)

    return () => clearInterval(interval)
  }, [content, onComplete])

  return (
    <div className="relative">
      <MarkdownResponse
        content={displayed}
        citations={citations}
        onCitationClick={onCitationClick}
      />
      <span className="inline-block h-3.5 w-1.5 ml-1 animate-pulse bg-accent rounded-xs align-middle" aria-hidden="true" />
    </div>
  )
}

export default StreamingText
