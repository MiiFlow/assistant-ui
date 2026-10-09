import { forwardRef, ReactNode } from "react";
import { WorkPanelLayout } from "../interactions/WorkPanel";
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
  /** Keep the bottom composer mounted beside an intro-only welcome screen. */
  showComposerOnWelcome?: boolean;
  /** Extra content between message list and composer (e.g. ClarificationPanel) */
  footer?: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/** Stable conversation and composer slots beside the shared result workspace. */
export const ChatLayout = forwardRef<HTMLDivElement, ChatLayoutProps>(
  (
    {
      isEmpty,
      header,
      welcomeScreen,
      messageList,
      composer,
      footer,
      className,
      showComposerOnWelcome = false,
    },
    ref,
  ) => (
    <div
      ref={ref}
      data-chat-ui
      data-welcome-composer={
        (isEmpty && !!welcomeScreen && showComposerOnWelcome) || undefined
      }
      className={cn(
        "chat-workspace relative h-full overflow-hidden flex flex-col min-h-0",
        className,
      )}
    >
      <WorkPanelLayout>
        {header}
        <div className="chat-workspace-body">
          {isEmpty && welcomeScreen ? welcomeScreen : messageList}
        </div>
        {(!isEmpty || !welcomeScreen || showComposerOnWelcome) && (
          <div className="chat-workspace-bottom">
            {footer}
            {composer}
          </div>
        )}
      </WorkPanelLayout>
    </div>
  ),
);
ChatLayout.displayName = "ChatLayout";
