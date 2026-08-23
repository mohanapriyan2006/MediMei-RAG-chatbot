const API_KEY = import.meta.env.VITE_GROQ_API_KEY ?? ''
const MODEL = import.meta.env.VITE_GROQ_MODEL ?? 'qwen/qwen3.6-27b'
const BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function buildHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${API_KEY}`,
  }
}

export async function* streamChat(
  messages: GroqMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: true,
      temperature: 0.2,
      max_tokens: 2048,
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`Groq ${res.status}: ${text}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream available')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') continue
      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) yield String(content)
      } catch {
        // ignore malformed JSON
      }
    }
  }
}

function stripFences(text: string): string {
  return text
    .replace(/^```(?:json)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim()
}

export async function completeJson<T>(
  messages: GroqMessage[],
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: MODEL,
      messages,
      stream: false,
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    throw new Error(`Groq ${res.status}: ${text}`)
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const text = json.choices?.[0]?.message?.content ?? ''
  const cleaned = stripFences(text)
  return JSON.parse(cleaned) as T
}