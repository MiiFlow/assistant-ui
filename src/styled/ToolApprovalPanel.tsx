import {
	useCallback,
	useEffect,
	useState,
	type ComponentType,
	type ReactNode,
} from "react";
import type { ToolApprovalData } from "../types";
import { cn } from "../utils/cn";

export interface ApprovalButtonSlotProps {
	onClick: () => void;
	disabled?: boolean;
	children: ReactNode;
}

export interface ApprovalChatInputSlotProps {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	onCancel: () => void;
	placeholder: string;
	disabled?: boolean;
	autoFocus?: boolean;
}

export interface ToolApprovalSlots {
	AllowButton?: ComponentType<ApprovalButtonSlotProps>;
	RejectButton?: ComponentType<ApprovalButtonSlotProps>;
	ChatButton?: ComponentType<ApprovalButtonSlotProps>;
	SendButton?: ComponentType<ApprovalButtonSlotProps>;
	CancelButton?: ComponentType<ApprovalButtonSlotProps>;
	ChatInput?: ComponentType<ApprovalChatInputSlotProps>;
}

export interface ToolApprovalPanelProps {
	approval: ToolApprovalData;
	onApprove: (modifiedInputs: Record<string, unknown>) => void;
	onReject: (reason?: string) => void;
	disabled?: boolean;
	className?: string;
	/**
	 * Per-action component overrides. Pass any subset; unspecified slots fall
	 * back to the library's default Tailwind-styled renderings. Use this to
	 * align buttons and input with a host app's brand system.
	 */
	slots?: ToolApprovalSlots;
}

type Mode = "idle" | "chat";

const INLINE_STRING_LIMIT = 140;

function formatPrimitive(value: unknown): string {
	if (value === null || value === undefined) return "—";
	if (typeof value === "boolean") return value ? "yes" : "no";
	if (typeof value === "number") return String(value);
	return String(value);
}

function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
	return (
		value === null ||
		value === undefined ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

function ValueCell({ value }: { value: unknown }) {
	const [expanded, setExpanded] = useState(false);

	if (isPrimitive(value)) {
		const text = formatPrimitive(value);
		const isLong = text.length > INLINE_STRING_LIMIT || text.includes("\n");
		if (!isLong) {
			return <span className="break-words">{text}</span>;
		}
		return (
			<div className="flex flex-col gap-1 min-w-0">
				{expanded ? (
					<pre className="whitespace-pre-wrap break-words text-xs font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1.5 max-h-60 overflow-auto">
						{text}
					</pre>
				) : (
					<span className="break-words text-current/80">{text.slice(0, INLINE_STRING_LIMIT)}…</span>
				)}
				<button
					type="button"
					onClick={() => setExpanded((e) => !e)}
					className="self-start text-[11px] underline-offset-2 hover:underline opacity-70 hover:opacity-100">
					{expanded ? "Show less" : "Show more"}
				</button>
			</div>
		);
	}

	if (Array.isArray(value) && value.every(isPrimitive)) {
		const text = value.map(formatPrimitive).join(", ") || "(empty)";
		return <span className="break-words">{text}</span>;
	}

	let pretty = "";
	try {
		pretty = JSON.stringify(value, null, 2);
	} catch {
		pretty = String(value);
	}

	return (
		<div className="flex flex-col gap-1 min-w-0">
			<button
				type="button"
				onClick={() => setExpanded((e) => !e)}
				className="self-start text-[11px] underline-offset-2 hover:underline opacity-70 hover:opacity-100">
				{expanded ? "Hide" : "Show"} {Array.isArray(value) ? "items" : "details"}
			</button>
			{expanded && (
				<pre className="whitespace-pre-wrap break-words text-xs font-mono bg-black/5 dark:bg-white/5 rounded px-2 py-1.5 max-h-60 overflow-auto">
					{pretty}
				</pre>
			)}
		</div>
	);
}

const DefaultAllowButton: ComponentType<ApprovalButtonSlotProps> = ({ onClick, disabled, children }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className={cn(
			"px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
			"bg-[var(--chat-approve-bg,#1c1917)] hover:bg-[var(--chat-approve-bg-hover,#292524)] text-[var(--chat-approve-text,white)]",
			"disabled:opacity-50 disabled:cursor-not-allowed",
		)}>
		{children}
	</button>
);

const DefaultRejectButton: ComponentType<ApprovalButtonSlotProps> = ({ onClick, disabled, children }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className={cn(
			"px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
			"bg-[var(--chat-reject-bg,#f5f5f4)] text-[var(--chat-reject-text,#44403c)] hover:bg-[var(--chat-reject-bg-hover,#e7e5e4)] dark:bg-[var(--chat-reject-bg-dark,rgba(255,255,255,0.06))] dark:text-[var(--chat-reject-text-dark,#e7e5e4)] dark:hover:bg-[var(--chat-reject-bg-hover-dark,rgba(255,255,255,0.1))]",
			"disabled:opacity-50 disabled:cursor-not-allowed",
		)}>
		{children}
	</button>
);

const DefaultGhostButton: ComponentType<ApprovalButtonSlotProps> = ({ onClick, disabled, children }) => (
	<button
		type="button"
		onClick={onClick}
		disabled={disabled}
		className={cn(
			"text-sm underline-offset-4 transition-colors",
			"text-[var(--chat-text-subtle,rgba(0,0,0,0.55))] hover:text-[var(--chat-text,#1c1917)] hover:underline",
			"dark:text-[var(--chat-text-subtle-dark,rgba(255,255,255,0.55))] dark:hover:text-[var(--chat-text-dark,#fafaf9)]",
			"disabled:opacity-50 disabled:cursor-not-allowed",
		)}>
		{children}
	</button>
);

const DefaultSendButton: ComponentType<ApprovalButtonSlotProps> = DefaultAllowButton;

const DefaultChatInput: ComponentType<ApprovalChatInputSlotProps> = ({
	value,
	onChange,
	onSubmit,
	onCancel,
	placeholder,
	disabled,
	autoFocus,
}) => (
	<textarea
		value={value}
		onChange={(e) => onChange(e.target.value)}
		onKeyDown={(e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				onSubmit();
			} else if (e.key === "Escape") {
				e.preventDefault();
				onCancel();
			}
		}}
		placeholder={placeholder}
		disabled={disabled}
		autoFocus={autoFocus}
		rows={2}
		className="w-full text-sm bg-transparent border-b border-[var(--chat-border,rgba(0,0,0,0.12))] dark:border-[var(--chat-border-dark,rgba(255,255,255,0.15))] focus:border-[var(--chat-text,#1c1917)] dark:focus:border-[var(--chat-text-dark,#fafaf9)] py-1.5 resize-y disabled:opacity-50 placeholder:text-[var(--chat-text-subtle,rgba(0,0,0,0.4))] outline-none transition-colors"
	/>
);

const INLINE_CHIP_LIMIT = 3;
const INLINE_CHIP_VALUE_MAX = 32;

function formatChipValue(value: unknown): string {
	const text = formatPrimitive(value);
	if (text.length <= INLINE_CHIP_VALUE_MAX) return text;
	return `${text.slice(0, INLINE_CHIP_VALUE_MAX - 1)}…`;
}

/**
 * Tool approval — rendered as a raised CTA above the composer to communicate
 * that the agent is paused on a decision. Anatomy:
 *
 *   ┌─ Approve action ─ <tool identity> ─────────────────────┐
 *   │  <agent's prompt sentence>                              │
 *   │  [param: value]  [param: value]                         │
 *   │  [ Approve ]  [ Decline ]    ⏎ approve · Esc decline    │
 *   │  Show all details                                       │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Buttons and the chat input are slottable via the `slots` prop so host apps
 * can swap in their own brand-aligned components.
 */
export function ToolApprovalPanel({
	approval,
	onApprove,
	onReject,
	disabled = false,
	className,
	slots,
}: ToolApprovalPanelProps) {
	const [mode, setMode] = useState<Mode>("idle");
	const [chatInput, setChatInput] = useState("");
	const [detailsOpen, setDetailsOpen] = useState(false);

	const handleAllow = useCallback(() => {
		onApprove(approval.toolInputs);
	}, [onApprove, approval.toolInputs]);

	const handleReject = useCallback(() => {
		onReject("User declined this action");
	}, [onReject]);

	const handleChatSubmit = useCallback(() => {
		const text = chatInput.trim();
		if (!text) return;
		onReject(text);
	}, [chatInput, onReject]);

	const handleChatCancel = useCallback(() => {
		setMode("idle");
		setChatInput("");
	}, []);

	// Keyboard shortcuts: ⏎ approves, Esc declines. Skip while focus is in
	// an editable element so the host composer/details inputs aren't hijacked.
	useEffect(() => {
		if (mode !== "idle" || disabled) return;
		const onKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const tag = target?.tagName;
			const editable =
				tag === "INPUT" ||
				tag === "TEXTAREA" ||
				tag === "SELECT" ||
				(target?.isContentEditable ?? false);
			if (editable) return;
			if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
				e.preventDefault();
				handleAllow();
			} else if (e.key === "Escape") {
				e.preventDefault();
				handleReject();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [mode, disabled, handleAllow, handleReject]);

	const summary = approval.toolDescription?.trim() || `Run ${approval.toolName}`;
	const toolIdentity = approval.toolLabel?.trim() || approval.toolName;

	const inputEntries = Object.entries(approval.toolInputs).filter(
		([key]) => key !== "__description",
	);
	const inlineChips = inputEntries.filter(([, v]) => isPrimitive(v)).slice(0, INLINE_CHIP_LIMIT);

	const AllowButton = slots?.AllowButton ?? DefaultAllowButton;
	const RejectButton = slots?.RejectButton ?? DefaultRejectButton;
	const SendButton = slots?.SendButton ?? DefaultSendButton;
	const CancelButton = slots?.CancelButton ?? DefaultGhostButton;
	const ChatInput = slots?.ChatInput ?? DefaultChatInput;

	return (
		<div
			role="group"
			aria-label="Tool approval"
			className={cn(
				"mx-4 mb-4 font-sans",
				"px-4 py-3.5 rounded-2xl",
				"bg-[var(--chat-approval-panel-bg,oklch(0.995_0.003_70))]",
				"border-[1.5px] border-[var(--chat-approval-panel-border,oklch(0.86_0.005_70))]",
				"shadow-[var(--chat-approval-panel-shadow,0_1px_0_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(0,0,0,0.10))]",
				"text-[var(--chat-text,#1c1917)] dark:text-[var(--chat-text-dark,#fafaf9)]",
				className,
			)}>
			{mode === "idle" && (
				<div className="flex items-center gap-2 mb-2 min-w-0">
					<span
						aria-hidden
						className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--chat-activity,var(--chat-primary,#106997))] animate-pulse-subtle shrink-0"
					/>
					<span className="uppercase tracking-[0.08em] text-[11px] font-semibold opacity-70 shrink-0">
						Approve action
					</span>
					{toolIdentity && (
						<>
							<span aria-hidden className="opacity-30 shrink-0">
								·
							</span>
							<span className="text-[11px] opacity-60 truncate" title={toolIdentity}>
								{toolIdentity}
							</span>
						</>
					)}
				</div>
			)}

			{/* Tool description can be long when the LLM emits a verbose
			    summary; cap with internal scroll so the action buttons below
			    stay reachable. */}
			<div className="max-h-[40vh] overflow-y-auto pr-1">
				<p className="text-base leading-relaxed">{summary}</p>
			</div>

			{mode === "idle" ? (
				<>
					{inlineChips.length > 0 && (
						<div className="mt-2.5 flex flex-wrap gap-1.5">
							{inlineChips.map(([key, value]) => (
								<span
									key={key}
									className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono bg-black/[0.04] dark:bg-white/[0.06]">
									<span className="opacity-60">{key}:</span>
									<span>{formatChipValue(value)}</span>
								</span>
							))}
						</div>
					)}

					<div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
						<AllowButton onClick={handleAllow} disabled={disabled}>
							Approve
						</AllowButton>
						<RejectButton onClick={handleReject} disabled={disabled}>
							Decline
						</RejectButton>
						{!disabled && (
							<span
								aria-hidden
								className="ml-auto text-[11px] opacity-50 select-none hidden sm:inline">
								<kbd className="font-sans">⏎</kbd> approve ·{" "}
								<kbd className="font-sans">Esc</kbd> decline
							</span>
						)}
					</div>

					{inputEntries.length > 0 && (
						<div className="mt-3">
							<button
								type="button"
								onClick={() => setDetailsOpen((o) => !o)}
								className="text-xs underline-offset-4 hover:underline opacity-60 hover:opacity-100 transition-opacity">
								{detailsOpen ? "Hide all details" : "Show all details"}
							</button>
							{detailsOpen && (
								<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs opacity-70 max-h-[40vh] overflow-y-auto pr-1">
									{inputEntries.map(([key, value]) => (
										<div key={key} className="contents">
											<dt className="font-mono text-[11px] pt-0.5 self-start">{key}</dt>
											<dd className="min-w-0">
												<ValueCell value={value} />
											</dd>
										</div>
									))}
								</dl>
							)}
						</div>
					)}
				</>
			) : (
				<div className="mt-3 flex flex-col gap-3">
					<ChatInput
						value={chatInput}
						onChange={setChatInput}
						onSubmit={handleChatSubmit}
						onCancel={handleChatCancel}
						placeholder="Tell me what you want instead…"
						disabled={disabled}
						autoFocus
					/>
					<div className="flex items-center gap-x-3">
						<SendButton onClick={handleChatSubmit} disabled={disabled || !chatInput.trim()}>
							Send
						</SendButton>
						<CancelButton onClick={handleChatCancel} disabled={disabled}>
							Cancel
						</CancelButton>
					</div>
				</div>
			)}
		</div>
	);
}
