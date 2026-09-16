/**
 * The words a failed init or send shows: in the transcript, and in the hook's
 * `error` field.
 */

import { isNetworkError } from "./network";

const GENERIC_SEND_FAILURE_TEXT = "Sorry, I encountered an error. Please try again.";

export interface SendFailureReport {
  /** The assistant bubble that answers the failed turn. */
  transcript: string;
  /** The hook-level `error`. */
  error: string;
}

/**
 * What a failed turn tells the user. A transport failure says so, and says
 * honestly whether the message got through: the server does not deduplicate
 * sends, so "try again" is the user's call. The hook's `error` then carries
 * the same words; any other failure keeps the error's own message there.
 */
export function describeSendFailure(
  err: unknown,
  responseStarted: boolean,
  assistantName: string | undefined
): SendFailureReport {
  if (!isNetworkError(err)) {
    return {
      transcript: GENERIC_SEND_FAILURE_TEXT,
      error: err instanceof Error ? err.message : "Send failed",
    };
  }
  const name = assistantName || "the assistant";
  const text = responseStarted
    ? `The connection dropped before ${name} finished replying. Check your connection and try again.`
    : `Couldn't reach ${name}, so this message may not have been sent. Check your connection and try again.`;
  return { transcript: text, error: text };
}

/** The hook-level `error` for a failed init. */
export function describeInitFailure(err: unknown): string {
  if (isNetworkError(err)) return "Can't reach the assistant. Check your connection.";
  return err instanceof Error ? err.message : "Failed to initialize";
}
