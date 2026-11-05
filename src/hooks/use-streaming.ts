import { useState, useCallback, useRef } from "react";
import type { StreamingState, StreamChunk, StreamingOptions } from "../types";

/**
 * Hook to manage streaming message state.
 */
export function useStreaming(options: StreamingOptions = {}) {
  const [state, setState] = useState<StreamingState>({
    isStreaming: false,
    streamingMessageId: null,
    streamedContent: "",
  });

  // The ref aborts whichever stream is current, even from a callback created
  // before that stream started. The signal handed out is state, so it changes
  // in the same render that starts a stream rather than a render later.
  const abortControllerRef = useRef<AbortController | null>(null);
  const [abortSignal, setAbortSignal] = useState<AbortSignal>();

  const startStreaming = useCallback((messageId: string) => {
    setState({
      isStreaming: true,
      streamingMessageId: messageId,
      streamedContent: "",
    });
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setAbortSignal(controller.signal);
  }, []);

  const appendContent = useCallback(
    (chunk: StreamChunk) => {
      if (chunk.type === "content" && chunk.content) {
        setState((prev) => ({
          ...prev,
          streamedContent: prev.streamedContent + chunk.content,
        }));
      }
      options.onChunk?.(chunk);
    },
    [options]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    const finalContent = state.streamedContent;

    setState({
      isStreaming: false,
      streamingMessageId: null,
      streamedContent: "",
    });

    options.onComplete?.(finalContent);
  }, [state.streamedContent, options]);

  const handleError = useCallback(
    (error: Error) => {
      abortControllerRef.current?.abort();
      setState({
        isStreaming: false,
        streamingMessageId: null,
        streamedContent: "",
      });
      options.onError?.(error);
    },
    [options]
  );

  return {
    ...state,
    startStreaming,
    appendContent,
    stopStreaming,
    handleError,
    abortSignal,
  };
}
