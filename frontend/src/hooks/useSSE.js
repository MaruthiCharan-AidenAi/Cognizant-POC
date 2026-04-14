import { useState, useCallback, useRef } from 'react'

/**
 * useSSE hook — EventSource wrapper for streaming chat responses.
 * 
 * Since EventSource doesn't support POST or custom headers, we use
 * fetch() with ReadableStream to handle SSE manually.
 */
export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false)
  const abortControllerRef = useRef(null)

  const startStream = useCallback(async ({ url, body, token, onChunk, onError, onDone }) => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    const controller = new AbortController()
    abortControllerRef.current = controller
    setIsStreaming(true)

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        onError?.({
          status: response.status,
          error: errorData.error || 'unknown_error',
          detail: errorData.detail || `HTTP ${response.status}`,
          retry_after: errorData.retry_after,
        })
        setIsStreaming(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data:')) continue

          const dataStr = trimmed.slice(5).trim()
          if (dataStr === '[DONE]') continue

          try {
            const data = JSON.parse(dataStr)
            if (data.type === 'error') {
              onError?.({
                status: 200,
                error: data.error || 'stream_error',
                detail: data.detail || 'Streaming failed',
              })
              return
            }
            onChunk?.(data)

            if (data.type === 'done') {
              onDone?.()
            }
          } catch {
            // Skip non-JSON data lines
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        onError?.({
          status: 0,
          error: 'network_error',
          detail: err.message || 'Network error',
        })
      }
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  return { isStreaming, startStream, stopStream }
}
