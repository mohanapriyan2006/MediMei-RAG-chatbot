import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance
  }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onend: () => void
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  [index: number]: { isFinal: boolean; [index: number]: SpeechRecognitionResult }
}

interface SpeechRecognitionErrorEvent {
  error: string
}

interface SpeechRecognitionResult {
  transcript: string
  confidence: number
}

interface UseVoiceInputOptions {
  valueRef: React.RefObject<string>
  onTranscript: (text: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

export function useVoiceInput({ valueRef, onTranscript, textareaRef }: UseVoiceInputOptions) {
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const finalTranscriptRef = useRef('')
  const shouldListenRef = useRef(false)

  const stopListening = useCallback(() => {
    shouldListenRef.current = false
    setListening(false)
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    finalTranscriptRef.current = ''
    textareaRef.current?.focus()
  }, [textareaRef])

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Speech recognition is not supported in this browser')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    finalTranscriptRef.current = valueRef.current ? valueRef.current + ' ' : ''
    shouldListenRef.current = true

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result: SpeechRecognitionResult = event.results[i][0]
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += result.transcript + ' '
        } else {
          interim += result.transcript
        }
      }
      onTranscript(finalTranscriptRef.current + interim)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      console.error('Speech recognition error:', event.error)
      shouldListenRef.current = false
      setListening(false)
      recognitionRef.current = null
    }

    recognition.onend = () => {
      if (shouldListenRef.current && recognitionRef.current === recognition) {
        try {
          recognition.start()
        } catch {
          shouldListenRef.current = false
          setListening(false)
          recognitionRef.current = null
        }
      } else if (recognitionRef.current === recognition) {
        setListening(false)
        recognitionRef.current = null
      }
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [valueRef, onTranscript])

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening()
    } else {
      startListening()
    }
  }, [listening, startListening, stopListening])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [])

  return { listening, toggleListening }
}
