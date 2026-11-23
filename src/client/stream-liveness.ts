/** A transport deadline, negotiated by the server's heartbeat frame. */
export const STREAM_INTERRUPTED = "The connection ended before the assistant finished. Refresh the chat to check for a result before retrying.";

export class StreamInterruptedError extends Error {
  constructor() {
    super(STREAM_INTERRUPTED);
    this.name = "StreamInterruptedError";
  }
}

export function createStreamLiveness(reader: ReadableStreamDefaultReader<Uint8Array>, idleMs = 60_000) {
  let heartbeatSupported = false;
  let terminal = false;
  let done = false;
  return {
    observe(frame: { type?: string }) {
      if (frame.type === "done" || frame.type === "error") done = true;
      if (frame.type === "heartbeat") heartbeatSupported = true;
      if (frame.type === "done" || frame.type === "assistant_complete" || frame.type === "error") terminal = true;
    },
    async read() {
      if (done) {
        void reader.cancel().catch(() => {});
        return { done: true as const, value: undefined };
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const read = reader.read();
        // Older servers do not send heartbeats. Never time out a legitimate
        // long tool call merely because the client deployed first.
        const result = heartbeatSupported
          ? await Promise.race([read, new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
              timer = setTimeout(() => {
                if (terminal) resolve({ done: true, value: undefined });
                else reject(new StreamInterruptedError());
                void reader.cancel().catch(() => {});
              }, idleMs);
            })])
          : await read;
        if (result.done && !terminal) throw new StreamInterruptedError();
        return result;
      } finally {
        if (timer !== undefined) clearTimeout(timer);
      }
    },
  };
}
