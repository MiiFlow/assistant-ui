/**
 * Session initialization and management for Miiflow embedded chat.
 */

import type {
	ClientToolDefinition,
	EmbedSession,
	EmbedSessionConfig,
	MiiflowChatConfig,
	PageContext,
	SystemEvent,
	ToolExecutionResult,
} from "./types";
import { isTokenExpiringSoon, parseTokenThreadId } from "./token-utils";
import { fetchOrNetworkError, readJsonOrThrow } from "./network";

/**
 * Determine the backend base URL from config.
 */
export function getBackendBaseUrl(config: MiiflowChatConfig): string {
	if (config.baseUrl) return config.baseUrl.replace(/\/api\/?$/, "");

	const isDev =
		config.bundleUrl?.includes("localhost") ||
		config.bundleUrl?.includes("127.0.0.1") ||
		false;
	return isDev ? "http://localhost:8003" : "https://api.miiflow.ai";
}

/**
 * Get or create a persistent anonymous user ID stored in localStorage.
 */
export function getOrCreateUserId(): string {
	const key = "miiflow-user-id";
	let userId: string | null = null;
	try {
		userId = localStorage.getItem(key);
	} catch {
		// localStorage may be unavailable (e.g. sandboxed iframe)
	}
	if (!userId) {
		userId = `muid_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
		try {
			localStorage.setItem(key, userId);
		} catch {
			// Ignore storage errors
		}
	}
	return userId;
}

/**
 * `session` carrying `token`, or null when the token is for a different
 * thread. A refresh takes a round trip, and the conversation can move to a
 * new thread while it is on the wire (a new chat, a thread switch); applying
 * the old thread's token to the new thread's session would send every later
 * request, and the websocket handshake, to the wrong conversation.
 */
export function sessionWithRefreshedToken(
	session: EmbedSession,
	token: string,
): EmbedSession | null {
	return parseTokenThreadId(token) === session.config.thread_id
		? { ...session, token }
		: null;
}

/** Refreshes on the wire, keyed by the token being replaced. */
const refreshesInFlight = new Map<string, Promise<string>>();

/**
 * Get a fresh token for the thread `token` is bound to. Unlike
 * {@link initSession}, this never moves the conversation: init hands a thread
 * that already has messages a brand-new thread, and re-registers only the
 * tools it is passed. The result is for THAT thread, so a caller must not put
 * it on a session that has since moved to another one
 * ({@link sessionWithRefreshedToken}). Takes the bare credentials so the media loader, which
 * holds no session object, shares it. Concurrent callers refreshing the same
 * token share one request: every refresh counts against the session's rate
 * limit, and the websocket and media loader both refresh near expiry.
 */
export function refreshSessionToken(
	backendBaseUrl: string,
	token: string,
	publicKey: string,
): Promise<string> {
	const key = `${backendBaseUrl}|${publicKey}|${token}`;
	const inFlight = refreshesInFlight.get(key);
	if (inFlight) return inFlight;

	const refresh = (async () => {
		const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/refresh`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${token}`,
				"X-Embed-Public-Key": publicKey,
			},
		});

		const data = await readJsonOrThrow(response, "Token refresh failed");
		if (!data.token) {
			throw new Error(data.error || "Token refresh returned no token");
		}
		return data.token as string;
	})().finally(() => {
		refreshesInFlight.delete(key);
	});
	refreshesInFlight.set(key, refresh);
	return refresh;
}

/**
 * Options for {@link initSession}.
 */
export interface InitSessionOptions {
	/**
	 * A previously-issued (cached) embed token. When present it is sent as a
	 * Bearer credential so the backend can take a fast path — skipping the
	 * public-key/HMAC handshake — and just mint a fresh thread. Backward
	 * compatible: older backends ignore the header and run the normal handshake.
	 */
	token?: string;
	/**
	 * Client tool definitions (without handlers) to register in the same
	 * round-trip as init, so no separate register-tool(s) call is needed.
	 * Backward compatible: older backends ignore the extra field.
	 */
	tools?: Array<Omit<ClientToolDefinition, "handler">>;
}

/**
 * Initialize an embed session by calling the backend init endpoint.
 */
export async function initSession(
	config: MiiflowChatConfig,
	options: InitSessionOptions = {},
): Promise<EmbedSession> {
	const backendBaseUrl = getBackendBaseUrl(config);

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		"X-Embed-Public-Key": config.publicKey,
		"x-mii-user-id": getOrCreateUserId(),
	};
	if (options.token) {
		headers["Authorization"] = `Bearer ${options.token}`;
	}

	// Identity the embedding site vouched for. All three headers travel
	// together or not at all: the backend only trusts `X-Embed-User-Data` when
	// the signature verifies against those exact bytes, so a partial set is
	// silently ignored and the session falls back to anonymous. `userData` is
	// forwarded verbatim for the same reason — re-serializing it here would
	// break every signature.
	if (config.hmac && config.timestamp && config.userData) {
		headers["X-Embed-User-Data"] = config.userData;
		headers["X-Embed-Timestamp"] = config.timestamp;
		headers["X-Embed-Signature"] = config.hmac;
	}

	const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/init`, {
		method: "POST",
		headers,
		body: JSON.stringify({
			assistant_id: config.assistantId,
			user_data: {
				user_id: config.userId,
				name: config.userName,
				email: config.userEmail,
			},
			...(options.tools && options.tools.length > 0
				? { tools: options.tools }
				: {}),
		}),
	});

	const data = await readJsonOrThrow(response, "Init failed");
	if (!data.success) {
		throw new Error(data.error || "Failed to initialize session");
	}

	return {
		token: data.token,
		config: data.config,
		session_id: data.session_id,
		registeredTools: Array.isArray(data.registered_tools)
			? data.registered_tools
			: undefined,
	};
}

// ============================================================================
// Session cache (token + branding config)
// ============================================================================

/**
 * Persist the auth token and branding config so a returning visitor can render
 * the branded shell instantly and let the backend skip the handshake. The
 * cached thread is intentionally NOT reused — each load still mints a fresh
 * thread — so only the token + branding config are useful across reloads.
 */
const SESSION_CACHE_PREFIX = "miiflow-session";
/** A cached token is reused only if it has at least this long left to live. */
const CACHED_TOKEN_MIN_TTL_MS = 5 * 60 * 1000;

export interface CachedSession {
	token: string;
	config: EmbedSessionConfig;
}

function sessionCacheKey(config: MiiflowChatConfig): string {
	return `${SESSION_CACHE_PREFIX}:${config.publicKey}:${config.assistantId}:${getOrCreateUserId()}`;
}

/**
 * Load a cached session, or null if absent, malformed, or the token is expired
 * / about to expire. Safe to call where localStorage is unavailable (SSR).
 */
export function loadCachedSession(config: MiiflowChatConfig): CachedSession | null {
	try {
		const raw = localStorage.getItem(sessionCacheKey(config));
		if (!raw) return null;
		const parsed = JSON.parse(raw) as CachedSession;
		if (!parsed?.token || !parsed?.config) return null;
		if (isTokenExpiringSoon(parsed.token, CACHED_TOKEN_MIN_TTL_MS)) return null;
		return parsed;
	} catch {
		return null;
	}
}

/** Cache the token + branding config from a freshly-initialized session. */
export function saveCachedSession(config: MiiflowChatConfig, session: EmbedSession): void {
	try {
		const payload: CachedSession = { token: session.token, config: session.config };
		localStorage.setItem(sessionCacheKey(config), JSON.stringify(payload));
	} catch {
		// localStorage may be unavailable or over quota — caching is best-effort.
	}
}

/** Remove a cached session (e.g. after the backend rejects a stale token). */
export function clearCachedSession(config: MiiflowChatConfig): void {
	try {
		localStorage.removeItem(sessionCacheKey(config));
	} catch {
		// Ignore storage errors.
	}
}

/**
 * Create a new thread for the current session.
 */
export async function createThread(
	config: MiiflowChatConfig,
	session: EmbedSession,
): Promise<{ threadId: string; token?: string }> {
	const backendBaseUrl = getBackendBaseUrl(config);

	const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/graphql`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.token}`,
			"x-mii-user-id": getOrCreateUserId(),
		},
		body: JSON.stringify({
			operationName: "CreateThread",
			variables: {
				input: {
					assistantId: session.config.assistant_id,
					name: "New Thread",
					isPreview: false,
				},
			},
			query: `mutation CreateThread($input: CreateThreadInput!) {
        createThread(input: $input) {
          thread { id status name isPreview }
        }
      }`,
		}),
	});

	const result = await readJsonOrThrow(response, "Failed to create thread");
	const newThreadId = result.data?.createThread?.thread?.id;

	if (!newThreadId) {
		throw new Error("No thread ID returned");
	}

	return { threadId: newThreadId, token: result.token };
}

/**
 * Update user data for the current session.
 */
export async function updateUser(
	config: MiiflowChatConfig,
	session: EmbedSession,
	userData: { user_id?: string; name?: string; email?: string },
): Promise<void> {
	const backendBaseUrl = getBackendBaseUrl(config);

	await fetchOrNetworkError(`${backendBaseUrl}/api/embed/update`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.token}`,
		},
		body: JSON.stringify({ user_data: userData }),
	});
}

/**
 * Upload a file attachment via REST endpoint.
 * Returns the attachment ID for use in sendMessage.
 */
export async function uploadFile(config: MiiflowChatConfig, session: EmbedSession, file: File): Promise<string> {
	const backendBaseUrl = getBackendBaseUrl(config);
	const uploadUrl = `${backendBaseUrl}/api/embed/upload-attachment`;

	const formData = new FormData();
	formData.append("file", file);

	const response = await fetchOrNetworkError(uploadUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${session.token}`,
			"x-mii-user-id": getOrCreateUserId(),
		},
		body: formData,
	});

	const json = await readJsonOrThrow(response, "Upload failed");
	const attachmentId = json.attachment?.id;

	if (!attachmentId) {
		throw new Error("No attachment ID returned");
	}

	return attachmentId;
}

/**
 * Send a system event to the backend (invisible to chat, processed by assistant).
 */
export async function sendSystemEvent(
	config: MiiflowChatConfig,
	session: EmbedSession,
	systemEvent: SystemEvent,
): Promise<void> {
	const backendBaseUrl = getBackendBaseUrl(config);

	const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/system-event`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.token}`,
			"x-mii-user-id": getOrCreateUserId(),
		},
		body: JSON.stringify({
			thread_id: session.config.thread_id,
			system_event: {
				action: systemEvent.action,
				description: systemEvent.description,
				followUpInstruction: systemEvent.followUpInstruction,
				metadata: systemEvent.metadata || {},
			},
		}),
	});

	const result = await readJsonOrThrow(response, "Failed to send system event");
	if (!result.success) {
		throw new Error(result.error || "Failed to send system event");
	}
}

/**
 * Append a hidden page-context message to the thread.
 *
 * Does not render in the UI and does not trigger an assistant response — the
 * content is preserved in history so the LLM sees it on the next user turn.
 */
export async function sendPageContext(
	config: MiiflowChatConfig,
	session: EmbedSession,
	context: PageContext,
): Promise<void> {
	const backendBaseUrl = getBackendBaseUrl(config);

	const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/page-context`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.token}`,
			"x-mii-user-id": getOrCreateUserId(),
		},
		body: JSON.stringify({
			thread_id: session.config.thread_id,
			page_context: {
				action: context.action,
				content: context.content,
				metadata: context.metadata || {},
			},
		}),
	});

	const result = await readJsonOrThrow(response, "Failed to send page context");
	if (!result.success) {
		throw new Error(result.error || "Failed to send page context");
	}
}

/**
 * Send a tool execution result back to the backend.
 */
export async function sendToolResult(
	config: MiiflowChatConfig,
	session: EmbedSession,
	result: ToolExecutionResult,
): Promise<void> {
	const backendBaseUrl = getBackendBaseUrl(config);

	const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/tool-result`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.token}`,
		},
		body: JSON.stringify(result),
	});

	const responseData = await readJsonOrThrow(response, "Failed to send tool result");
	if (!responseData.success) {
		throw new Error(`Failed to send tool result: ${responseData.error}`);
	}
}

/**
 * Register tool definitions with the backend.
 */
export async function registerToolsOnBackend(
	config: MiiflowChatConfig,
	session: EmbedSession,
	toolDefinitions: Array<Omit<import("./types").ClientToolDefinition, "handler">>,
): Promise<void> {
	const backendBaseUrl = getBackendBaseUrl(config);

	if (toolDefinitions.length === 1) {
		const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/register-tool`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.token}`,
			},
			body: JSON.stringify(toolDefinitions[0]),
		});

		const data = await readJsonOrThrow(response, "Failed to register tool");
		if (!data.success) {
			throw new Error(`Failed to register tool: ${data.error || "Unknown error"}`);
		}
	} else if (toolDefinitions.length > 1) {
		const response = await fetchOrNetworkError(`${backendBaseUrl}/api/embed/register-tools`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.token}`,
			},
			body: JSON.stringify(toolDefinitions),
		});

		const data = await readJsonOrThrow(response, "Failed to register tools");
		if (!data.success) {
			throw new Error(`Failed to register tools: ${data.error || "Unknown error"}`);
		}
	}
}
