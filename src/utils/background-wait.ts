/** Durable wait metadata is authoritative; a saved transcript's status is not liveness. */
export interface BackgroundWait {
	id: string;
	status?: string;
	run_id?: string;
	thread_id?: string;
}

export function readBackgroundWait(metadata: Record<string, unknown> | undefined): BackgroundWait | undefined {
	const value = metadata?.background_wait;
	if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !value.id) return undefined;
	return value as BackgroundWait;
}

export function isBackgroundWaitOpen(wait: BackgroundWait | undefined): boolean {
	return !!wait && (wait.status == null || wait.status === "waiting" || wait.status === "resuming");
}
