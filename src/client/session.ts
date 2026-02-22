/**
 * Session initialization and management for Miiflow embedded chat.
 */

import type { EmbedSession, MiiflowChatConfig, SystemEvent, ToolExecutionResult } from "./types";

/**
 * Determine the backend base URL from config.
 */
export function getBackendBaseUrl(config: MiiflowChatConfig): string {
	if (config.baseUrl) return config.baseUrl.replace(/\/api\/?$/, "");

	const isDev =
		config.bundleUrl?.includes("localhost") ||
		config.bundleUrl?.includes("127.0.0.1") ||
		config.bundleUrl?.includes("ngrok.app") ||
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
 * Initialize an embed session by calling the backend init endpoint.
 */
export async function initSession(config: MiiflowChatConfig): Promise<EmbedSession> {
	const backendBaseUrl = getBackendBaseUrl(config);

	const response = await fetch(`${backendBaseUrl}/api/embed/init`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"X-Embed-Public-Key": config.publicKey,
			"x-mii-user-id": getOrCreateUserId(),
		},
		body: JSON.stringify({
			assistant_id: config.assistantId,
			user_data: {
				user_id: config.userId,
				name: config.userName,
				email: config.userEmail,
			},
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
	};
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
