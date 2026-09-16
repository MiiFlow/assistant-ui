/**
 * Transport failures for the embedded chat client: what went wrong between the
 * device and the backend, told apart from what the backend answered.
 */

/**
 * The request never produced a complete response because the device could not
 * talk to the backend: offline, DNS, TLS, or a connection dropped mid-body.
 * Browsers report all of these as a bare `TypeError` ("Load failed",
 * "Failed to fetch", "NetworkError when attempting to fetch resource") that
 * is indistinguishable from a bug, so the transport boundary re-throws them as
 * this class. Anything that is NOT a `NetworkError` got an answer from the
 * server (an HTTP status or a stream `error` frame).
 *
 * The server may or may not have received the request, so a `NetworkError` is
 * never a licence to replay a non-idempotent call.
 */
export class NetworkError extends Error {
	constructor(cause: unknown) {
		super(cause instanceof Error ? cause.message : String(cause));
		this.name = "NetworkError";
		this.cause = cause;
	}
}

/** The backend answered with a non-2xx status. */
export class HttpError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
		this.name = "HttpError";
	}
}

export function isNetworkError(err: unknown): err is NetworkError {
	return err instanceof NetworkError;
}

/**
 * A failure that says nothing about the request itself, so repeating an
 * idempotent call later can succeed: the backend was unreachable, restarting
 * (5xx), or rate limiting (429). Every other answer is the backend's verdict.
 */
export function isTransientFailure(err: unknown): boolean {
	if (isNetworkError(err)) return true;
	return err instanceof HttpError && (err.status >= 500 || err.status === 429);
}

function isAbortError(err: unknown): boolean {
	return err instanceof DOMException && err.name === "AbortError";
}

/** Re-throw a transport rejection as {@link NetworkError}; aborts pass through. */
export function toNetworkError(err: unknown): unknown {
	return isAbortError(err) || err instanceof NetworkError ? err : new NetworkError(err);
}

/** `fetch`, with transport failures surfaced as {@link NetworkError}. */
export async function fetchOrNetworkError(
	input: string,
	init?: RequestInit,
): Promise<Response> {
	try {
		return await fetch(input, init);
	} catch (err) {
		throw toNetworkError(err);
	}
}

/**
 * Read a response body. The body arrives after the headers, so the connection
 * can still drop here; that is a transport failure too. A `SyntaxError` from
 * `json()` is the server's answer being malformed, not the network.
 */
export async function readBody<T>(read: () => Promise<T>): Promise<T> {
	try {
		return await read();
	} catch (err) {
		throw err instanceof SyntaxError ? err : toNetworkError(err);
	}
}

/**
 * The JSON body of a response, or the failure: an {@link HttpError} carrying
 * the status for a non-2xx answer, a {@link NetworkError} if the body never
 * finished arriving. `failure` prefixes the HTTP error's message.
 */
export async function readJsonOrThrow<T = any>(response: Response, failure: string): Promise<T> {
	if (!response.ok) {
		const detail = await readBody(() => response.text());
		throw new HttpError(`${failure}: ${response.status} - ${detail}`, response.status);
	}
	return readBody(() => response.json());
}
