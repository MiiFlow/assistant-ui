import { motion } from "framer-motion";
import { MessageCircleQuestion, Paperclip, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";

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
	/** Additional CSS classes for the outer wrapper */
	className?: string;
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
}: {
	placeholder: string;
	onSubmit: (msg: string, files?: File[]) => void;
	disabled?: boolean;
	supportsAttachments?: boolean;
}) {
	const [value, setValue] = useState("");
	const [files, setFiles] = useState<File[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Auto-resize
	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
		}
	}, [value]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleSubmit = () => {
		if ((!value.trim() && files.length === 0) || disabled) return;
		onSubmit(value.trim(), files.length > 0 ? files : undefined);
		setValue("");
		setFiles([]);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
		}
		e.target.value = "";
	};

	const removeFile = (index: number) => {
		setFiles((prev) => prev.filter((_, i) => i !== index));
	};

	return (
		<form
			className={cn(
				"w-full relative mx-auto",
				"bg-white dark:bg-gray-800",
				"rounded-2xl overflow-hidden",
				"shadow-[0_8px_30px_rgba(0,0,0,0.08)]",
				"border border-gray-100 dark:border-gray-700/50",
				"transition duration-200",
				"focus-within:shadow-[0_8px_30px_rgba(0,0,0,0.12)] focus-within:border-gray-200 dark:focus-within:border-gray-600",
			)}
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}>
			{/* File previews */}
			{files.length > 0 && (
				<div className="flex flex-wrap gap-2 px-4 pt-3">
					{files.map((file, i) => (
						<div
							key={`${file.name}-${i}`}
							className={cn(
								"flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs",
								"bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
							)}>
							<span className="max-w-[120px] truncate">{file.name}</span>
							<button
								type="button"
								onClick={() => removeFile(i)}
								className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
								<X size={12} />
							</button>
						</div>
					))}
				</div>
			)}

			<div className="flex items-center gap-2">
				{/* Paperclip button */}
				{supportsAttachments && (
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={disabled}
						className={cn(
							"ml-3 flex-shrink-0",
							"w-8 h-8 rounded-lg",
							"flex items-center justify-center",
							"text-gray-400 dark:text-gray-500",
							"hover:bg-gray-100 dark:hover:bg-gray-700",
							"hover:text-gray-600 dark:hover:text-gray-300",
							"disabled:opacity-40 disabled:cursor-not-allowed",
							"transition-colors",
						)}>
						<Paperclip size={16} />
					</button>
				)}

				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => setValue(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					rows={1}
					placeholder={placeholder}
					className={cn(
						"flex-1 text-sm sm:text-base",
						"border-none bg-transparent",
						"text-gray-900 dark:text-white",
						"focus:outline-none focus:ring-0 resize-none",
						"py-4 sm:py-5",
						supportsAttachments ? "pl-1" : "pl-4 sm:pl-6",
						"placeholder:text-gray-400 dark:placeholder:text-gray-500",
						"disabled:opacity-50 disabled:cursor-not-allowed",
						"max-h-[200px] overflow-y-auto",
					)}
				/>
				<button
					type="submit"
					disabled={(!value.trim() && files.length === 0) || !!disabled}
					className={cn(
						"mr-3 flex-shrink-0",
						"w-9 h-9 rounded-lg",
						"flex items-center justify-center",
						"bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900",
						"shadow-sm",
						"hover:bg-gray-700 dark:hover:bg-gray-300",
						"hover:shadow-md hover:-translate-y-px",
						"active:translate-y-0 active:shadow-sm",
						"disabled:bg-gray-300 dark:disabled:bg-gray-600",
						"disabled:text-gray-500 dark:disabled:text-gray-400",
						"disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed",
						"transition-all duration-200",
					)}>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round">
						<path d="M12 19V5M5 12l7-7 7 7" />
					</svg>
				</button>
			</div>

			{/* Hidden file input */}
			{supportsAttachments && (
				<input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
			)}
		</form>
	);
}

// ---------------------------------------------------------------------------
// Suggestion card
// ---------------------------------------------------------------------------

function SuggestionCard({ text, onClick, index }: { text: string; onClick: () => void; index: number }) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const prefersReducedMotion = useRef(
		typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
	);
	const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

	const handleMouseMove = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (prefersReducedMotion.current) return;
			const rect = e.currentTarget.getBoundingClientRect();
			setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
		},
		[],
	);

	const handleMouseLeave = useCallback(() => {
		setMousePos(null);
	}, []);

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.2 + index * 0.1, duration: 0.4 }}>
			<button
				ref={buttonRef}
				type="button"
				onClick={onClick}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
				className={cn(
					"relative overflow-hidden",
					"w-full text-left",
					"p-3",
					"cursor-pointer",
					"border border-gray-200 dark:border-gray-700",
					"rounded-lg",
					"transition-all duration-200 ease-out",
					"bg-white dark:bg-gray-800",
					"hover:border-gray-300 dark:hover:border-gray-600",
					"hover:bg-gray-50 dark:hover:bg-gray-750",
					"hover:shadow-sm",
					"active:bg-gray-100 dark:active:bg-gray-700",
				)}>
				{/* Mouse-tracking shimmer overlay */}
				{mousePos && (
					<div
						className="pointer-events-none absolute inset-0 z-0"
						style={{
							background: `radial-gradient(120px circle at ${mousePos.x}px ${mousePos.y}px, var(--chat-halo-primary, rgba(16,105,151,0.06)), transparent)`,
						}}
					/>
				)}
				<div className="relative z-10 flex items-start gap-2.5">
					<MessageCircleQuestion
						size={16}
						strokeWidth={2}
						className="mt-0.5 text-gray-400 dark:text-gray-500 flex-shrink-0"
					/>
					<span className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed flex-1">{text}</span>
				</div>
			</button>
		</motion.div>
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
			className,
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
					className="pointer-events-none absolute inset-0 animate-welcome-halo"
					style={{
						background: `radial-gradient(ellipse 60% 50% at 50% 45%, var(--chat-halo-primary, rgba(16,105,151,0.06)), var(--chat-halo-secondary, rgba(86,193,138,0.03)) 60%, transparent 100%)`,
					}}
				/>

				<motion.div
					layout
					initial={{ scale: 0.95, y: 20, opacity: 0 }}
					animate={{ scale: 1, y: 0, opacity: 1 }}
					transition={{ type: "spring", stiffness: 200, damping: 25 }}
					className="relative w-full max-w-[800px] flex flex-col items-center gap-8">
					{/* Welcome heading */}
					{welcomeText && (
						<motion.h2
							initial={{ opacity: 0, y: -10 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.1, duration: 0.4 }}
							className="text-2xl font-semibold text-gray-800 dark:text-gray-300 text-center">
							{welcomeText}
						</motion.h2>
					)}

					{/* Composer with glow ring */}
					<div
						className={cn(
							"w-full rounded-2xl",
							"transition-shadow duration-500",
							"shadow-[0_0_15px_rgba(16,105,151,0.08)]",
							"focus-within:shadow-[0_0_20px_rgba(16,105,151,0.15),0_0_40px_rgba(86,193,138,0.08)]",
							"dark:shadow-[0_0_15px_rgba(16,105,151,0.12)]",
							"dark:focus-within:shadow-[0_0_20px_rgba(16,105,151,0.22),0_0_40px_rgba(86,193,138,0.12)]",
						)}>
						{composerSlot ?? (
							<DefaultInput
								placeholder={placeholder}
								onSubmit={(msg, files) => onSubmit?.(msg, files)}
								supportsAttachments={supportsAttachments}
							/>
						)}
					</div>

					{/* Suggestion cards */}
					{suggestions.length > 0 && (
						<div
							className={cn(
								"grid gap-3 w-full max-w-[900px]",
								"grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(250px,1fr))]",
							)}>
							{suggestions.map((text, i) => (
								<SuggestionCard key={i} text={text} onClick={() => handleSuggestionClick(text)} index={i} />
							))}
						</div>
					)}
				</motion.div>
			</div>
		);
	},
);

WelcomeScreen.displayName = "WelcomeScreen";
