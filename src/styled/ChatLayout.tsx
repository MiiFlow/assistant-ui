import { AnimatePresence, motion } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "../utils/cn";

export interface ChatLayoutProps {
	/** Whether the chat is in empty state (no messages) */
	isEmpty: boolean;
	/** Optional header rendered above the message area */
	header?: ReactNode;
	/** Content to display when isEmpty is true (typically a WelcomeScreen) */
	welcomeScreen?: ReactNode;
	/** The message list to display when not empty */
	messageList?: ReactNode;
	/** The composer rendered at the bottom when not empty */
	composer?: ReactNode;
	/** Extra content between message list and composer (e.g. ClarificationPanel) */
	footer?: ReactNode;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Composable chat layout that handles the empty → active state transition
 * with a smooth crossfade animation.
 *
 * Replaces the repeated `AnimatePresence` + `motion.div` pattern found in
 * `centered-chat-layout.tsx` and `chat/[id]/page.tsx`.
 */
export const ChatLayout = forwardRef<HTMLDivElement, ChatLayoutProps>(
	({ isEmpty, header, welcomeScreen, messageList, composer, footer, className }, ref) => {
		return (
			<div ref={ref} className={cn("relative h-full overflow-hidden flex flex-col", className)}>
				<AnimatePresence mode="wait">
					{isEmpty && welcomeScreen ? (
						<motion.div
							key="welcome"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.3 }}
							className="flex-1 flex flex-col overflow-hidden">
							{header}
							{welcomeScreen}
						</motion.div>
					) : (
						<motion.div
							key="active"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ duration: 0.4 }}
							className="flex-1 flex flex-col overflow-hidden">
							{header}

							{/* Message list */}
							<motion.div
								initial={{ opacity: 0, y: -20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4, delay: 0.1 }}
								className="flex-1 overflow-hidden flex flex-col">
								{messageList}
							</motion.div>

							{/* Footer slot (e.g. ClarificationPanel) */}
							{footer}

							{/* Composer */}
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4, delay: 0.2 }}>
								{composer}
							</motion.div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		);
	},
);

ChatLayout.displayName = "ChatLayout";
