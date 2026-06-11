import { motion } from "framer-motion";
import { ArrowUp, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
	LexicalChatInput,
	type CommandProvider,
	type LexicalChatInputHandle,
} from "../composer";
import { cn } from "../utils/cn";
import { Avatar } from "./Avatar";
import { ComposerToolbar } from "./ComposerToolbar";

export interface WelcomeScreenProps {
	/** Rotating placeholder strings displayed in the input */
	placeholders?: string[];
	/** Preset suggestion cards shown below the input */
	suggestions?: string[];
	/** Called when the user submits a message via the built-in input */
	onSubmit?: (message: string, files?: File[]) => void;
	/** Called when the user clicks a suggestion card */
	onSuggestionClick?: (suggestion: string) => void;
	/** Welcome heading text */
	welcomeText?: string;
	/** Whether to show the attachment (paperclip) button */
	supportsAttachments?: boolean;
	/** Override the default plain-text input with a custom composer (e.g. chat-ui MessageComposer) */
	composerSlot?: ReactNode;
	/** Optional slash-command typeahead provider (e.g. for skill picker). */
	commandProvider?: CommandProvider | null;
	/** Multiple typeahead providers for distinct triggers (e.g. `/` skills +
	 *  modes plus `@` ad accounts). Takes precedence over `commandProvider`. */
	commandProviders?: CommandProvider[];
	/** Additional CSS classes for the outer wrapper */
	className?: string;
	/** Assistant avatar image URL — when provided, welcome text renders in message format */
	assistantAvatar?: string;
	/** Assistant display name (shown alongside avatar) */
	assistantName?: string;
}

// ---------------------------------------------------------------------------
// Rotating placeholder hook
// ---------------------------------------------------------------------------

function useRotatingPlaceholder(placeholders: string[], intervalMs = 3000) {
	const [index, setIndex] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (placeholders.length <= 1) return;

		const start = () => {
			intervalRef.current = setInterval(() => {
				setIndex((prev) => (prev + 1) % placeholders.length);
			}, intervalMs);
		};

		const handleVisibility = () => {
			if (document.visibilityState !== "visible") {
				if (intervalRef.current) {
					clearInterval(intervalRef.current);
					intervalRef.current = null;
				}
			} else {
				start();
			}
		};

		start();
		document.addEventListener("visibilitychange", handleVisibility);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, [placeholders, intervalMs]);

	return placeholders[index] ?? "";
}

// ---------------------------------------------------------------------------
// Default inline input (simple textarea, no Lexical)
// ---------------------------------------------------------------------------

function DefaultInput({
	placeholder,
	onSubmit,
	disabled,
	supportsAttachments,
	commandProvider,
	commandProviders,
}: {
	placeholder: string;
	onSubmit: (msg: string, files?: File[]) => void;
	disabled?: boolean;
	supportsAttachments?: boolean;
	commandProvider?: CommandProvider | null;
	commandProviders?: CommandProvider[];
}) {
	const [hasText, setHasText] = useState(false);
	const [files, setFiles] = useState<File[]>([]);
	const inputRef = useRef<LexicalChatInputHandle>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleSubmit = useCallback(
		(text: string) => {
			if ((!text.trim() && files.length === 0) || disabled) return;
			onSubmit(text.trim(), files.length > 0 ? files : undefined);
			inputRef.current?.clear();
			setHasText(false);
			setFiles([]);
		},
		[disabled, files, onSubmit],
	);

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
		}
		e.target.value = "";
	};

	const removeFile = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	const canSubmit = (hasText || files.length > 0) && !disabled;

	return (
		<div
			className={cn("w-full relative mx-auto", "rounded-2xl overflow-hidden", "chat-composer-shell group")}
			style={{ borderRadius: "1rem", overflow: "hidden" }}>
			{/* File previews */}
			{files.length > 0 && (
				<div className="flex flex-wrap gap-2 px-4 pt-3">
					{files.map((file, i) => (
						<div
							key={`${file.name}-${i}`}
							className={cn(
								"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs",
								"bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300",
							)}>
							<span className="max-w-[120px] truncate">{file.name}</span>
							<button
								type="button"
								onClick={() => removeFile(i)}
								className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200">
								<X size={12} />
							</button>
						</div>
					))}
				</div>
			)}

			{/* Text row */}
			<LexicalChatInput
				ref={inputRef}
				placeholder={placeholder}
				disabled={disabled}
				commandProvider={commandProvider ?? null}
				commandProviders={commandProviders}
				className="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-1"
				inputClassName="text-sm sm:text-base text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500"
				placeholderClassName="text-sm sm:text-base"
				onChange={({ text }) => setHasText(text.trim().length > 0)}
				onSubmit={({ text }) => handleSubmit(text)}
			/>

			{/* Toolbar row */}
			<ComposerToolbar
				className="px-2.5 pb-2.5 pt-1"
				onAttachClick={supportsAttachments ? () => fileInputRef.current?.click() : undefined}
				disabled={disabled}
				endSlot={
					<button
						type="button"
						onClick={() => inputRef.current?.submit()}
						disabled={!canSubmit}
						aria-label="Send message"
						className={cn(
							"flex-shrink-0",
							"w-8 h-8 rounded-lg",
							"flex items-center justify-center",
							"bg-gray-900 dark:bg-zinc-600 text-zinc-50",
							"shadow-sm",
							"hover:bg-gray-700 dark:hover:bg-zinc-500",
							"active:scale-95",
							"disabled:bg-gray-300 dark:disabled:bg-zinc-700",
							"disabled:text-gray-500 dark:disabled:text-zinc-400",
							"disabled:shadow-none disabled:cursor-not-allowed",
							"transition-[background-color,color,transform] duration-150",
						)}>
						<ArrowUp size={16} strokeWidth={2} />
					</button>
				}
			/>

			{/* Hidden file input */}
			{supportsAttachments && (
				<input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
			)}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Suggestion pill
// ---------------------------------------------------------------------------

function SuggestionPill({ text, onClick, index }: { text: string; onClick: () => void; index: number }) {
	return (
		<motion.button
			type="button"
			onClick={onClick}
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ delay: 0.15 + index * 0.03, duration: 0.2 }}
			className={cn(
				"inline-flex items-center rounded-full",
				"border border-[var(--chat-border,rgba(29,32,51,0.08))]",
				"px-3.5 py-1.5",
				"text-sm leading-normal text-left",
				"text-[var(--chat-text-subtle,rgba(0,0,0,0.5))]",
				"cursor-pointer select-none",
				"transition-colors duration-150",
				"hover:bg-[var(--chat-panel-bg,rgba(0,0,0,0.02))]",
				"hover:border-[var(--chat-border-hover,rgba(0,0,0,0.12))]",
				"hover:text-[var(--chat-text,#1d2033)]",
				"active:bg-[var(--chat-message-bg,rgba(0,0,0,0.03))]",
			)}
			style={{ borderRadius: "9999px" }}>
			{text}
		</motion.button>
	);
}

// ---------------------------------------------------------------------------
// WelcomeScreen
// ---------------------------------------------------------------------------

/**
 * Full-screen empty state with rotating placeholder input and suggestion cards.
 * Used as the welcome screen when no messages exist.
 *
 * By default renders a simple textarea input. Pass `composerSlot` to override
 * with e.g. the Lexical-based `MessageComposer`.
 */
export const WelcomeScreen = forwardRef<HTMLDivElement, WelcomeScreenProps>(
	(
		{
			placeholders = [],
			suggestions = [],
			onSubmit,
			onSuggestionClick,
			welcomeText = "How can I help you today?",
			supportsAttachments,
			composerSlot,
			commandProvider,
			commandProviders,
			className,
			assistantAvatar,
			assistantName,
		},
		ref,
	) => {
		const placeholder = useRotatingPlaceholder(placeholders);

		const handleSuggestionClick = useCallback(
			(text: string) => {
				onSuggestionClick?.(text);
			},
			[onSuggestionClick],
		);

		return (
			<div ref={ref} className={cn("relative overflow-hidden", "flex-1 flex items-center justify-center", "px-4 sm:px-6", className)}>
				{/* Ambient background halo */}
				<div
					className="pointer-events-none absolute inset-0"
					style={{
						background: `radial-gradient(ellipse 60% 50% at 50% 45%, var(--chat-halo-primary, rgba(16,105,151,0.06)), var(--chat-halo-secondary, rgba(86,193,138,0.03)) 60%, transparent 100%)`,
					}}
				/>

				<motion.div
					layout
					initial={{ y: 8, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
					className="relative w-full max-w-[800px] flex flex-col items-center gap-8">
					{/* Welcome heading — message format when avatar is configured */}
					{welcomeText && assistantAvatar ? (
						<motion.div
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
							className="flex items-start gap-2 w-full">
							<div className="flex-shrink-0">
								<Avatar
									name={assistantName}
									src={assistantAvatar}
									role="assistant"
									className="w-10 h-10 flex-shrink-0"
								/>
							</div>
							<div className="rounded-2xl px-4 py-3">
								<p
									style={{ fontSize: "1rem", lineHeight: "1.5rem", color: "var(--chat-text, #1d2033)" }}
									className="text-base">
									{welcomeText}
								</p>
							</div>
						</motion.div>
					) : welcomeText ? (
						<motion.h2
							initial={{ opacity: 0, y: -8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.05, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
							style={{
								fontSize: "1.5rem",
								lineHeight: "2rem",
								fontWeight: 600,
								letterSpacing: "-0.01em",
								color: "var(--chat-text, #1d2033)",
							}}
							className="text-2xl font-semibold text-center">
							{welcomeText}
						</motion.h2>
					) : null}

					{/* Composer */}
					<div className="w-full">
						{composerSlot ?? (
							<DefaultInput
								placeholder={placeholder}
								onSubmit={(msg, files) => onSubmit?.(msg, files)}
								supportsAttachments={supportsAttachments}
								commandProvider={commandProvider ?? null}
								commandProviders={commandProviders}
							/>
						)}
					</div>

					{/* Suggestion pills */}
					{suggestions.length > 0 && (
						<div className="flex flex-wrap justify-center gap-2 w-full max-w-[640px]">
							{suggestions.map((text, i) => (
								<SuggestionPill key={i} text={text} onClick={() => handleSuggestionClick(text)} index={i} />
							))}
						</div>
					)}
				</motion.div>
			</div>
		);
	},
);

WelcomeScreen.displayName = "WelcomeScreen";
