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
import { isTokenExpiringSoon } from "./token-utils";

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

	const response = await fetch(`${backendBaseUrl}/api/embed/init`, {
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

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Init failed: ${response.status} - ${errorText}`);
	}

	const data = await response.json();
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
/** Treat a cached token as unusable once it is within this window of expiry. */
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000;

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
		if (isTokenExpiringSoon(parsed.token, TOKEN_REFRESH_THRESHOLD_MS)) return null;
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

	const response = await fetch(`${backendBaseUrl}/api/embed/graphql`, {
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

	if (!response.ok) {
		throw new Error(`Failed to create thread: ${response.status}`);
	}

	const result = await response.json();
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

	await fetch(`${backendBaseUrl}/api/embed/update`, {
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

	const response = await fetch(uploadUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${session.token}`,
			"x-mii-user-id": getOrCreateUserId(),
		},
		body: formData,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Upload failed: ${response.status} - ${errorText}`);
	}

	const json = await response.json();
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

	const response = await fetch(`${backendBaseUrl}/api/embed/system-event`, {
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

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to send system event: ${response.status} - ${errorText}`);
	}

	const result = await response.json();
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

	const response = await fetch(`${backendBaseUrl}/api/embed/page-context`, {
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

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to send page context: ${response.status} - ${errorText}`);
	}

	const result = await response.json();
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

	const response = await fetch(`${backendBaseUrl}/api/embed/tool-result`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session.token}`,
		},
		body: JSON.stringify(result),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to send tool result: ${response.status} - ${errorText}`);
	}

	const responseData = await response.json();
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
		const response = await fetch(`${backendBaseUrl}/api/embed/register-tool`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.token}`,
			},
			body: JSON.stringify(toolDefinitions[0]),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to register tool: ${response.status} - ${errorText}`);
		}
		const data = await response.json();
		if (!data.success) {
			throw new Error(`Failed to register tool: ${data.error || "Unknown error"}`);
		}
	} else if (toolDefinitions.length > 1) {
		const response = await fetch(`${backendBaseUrl}/api/embed/register-tools`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${session.token}`,
			},
			body: JSON.stringify(toolDefinitions),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to register tools: ${response.status} - ${errorText}`);
		}
		const data = await response.json();
		if (!data.success) {
			throw new Error(`Failed to register tools: ${data.error || "Unknown error"}`);
		}
	}
}
