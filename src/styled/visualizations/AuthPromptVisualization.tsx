import { Lock } from "lucide-react";
import { cn } from "../../utils/cn";
import type {
  AuthPromptVisualizationData,
  VisualizationActionEvent,
  VisualizationConfig,
} from "../../types";

export interface AuthPromptVisualizationProps {
  data: AuthPromptVisualizationData;
  config?: VisualizationConfig;
  isStreaming?: boolean;
  onAction?: (event: VisualizationActionEvent) => void;
}

/**
 * "Connect your account" card for an integration the assistant could not use.
 *
 * This is the PACKAGE-level renderer, and it is deliberately presentational:
 * running the OAuth flow needs the host's session, GraphQL client and popup
 * plumbing, none of which belong here (see the styled/ agnosticism rule). A
 * host that can connect passes `onAction`; the app's MUI override in
 * `web/components/assistants/chat/visualizations/` replaces this entirely.
 *
 * It exists because a registered *fallback* is what separates a degraded render
 * from a broken one. Every other visualization type had one; `auth_prompt` was
 * contributed only by the host's registration module, so when a production
 * build elided that module the card rendered as the literal text "Unknown
 * visualization type: auth_prompt" in users' threads (2026-08-02).
 *
 * Without `onAction` there is nothing a button could do, so none is drawn — a
 * dead Connect button reads as a broken feature rather than a missing one.
 */
export function AuthPromptVisualization({
  data,
  onAction,
}: AuthPromptVisualizationProps) {
  const name = data.mcpServerName || data.providerName;
  const canConnect = Boolean(onAction);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2",
        "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900",
      )}
    >
      {data.providerLogo ? (
        <img
          src={data.providerLogo}
          alt={name}
          className="h-6 w-6 shrink-0 object-contain"
        />
      ) : (
        <Lock size={16} className="shrink-0 text-gray-400" aria-hidden />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {name}
        </div>
        {data.reason && (
          <div className="truncate text-xs text-gray-500 dark:text-gray-400">
            {data.reason}
          </div>
        )}
      </div>

      {canConnect && (
        <button
          type="button"
          onClick={() =>
            onAction?.({
              type: "auth_connect",
              providerName: data.providerName,
              mcpServerId: data.mcpServerId,
              serviceProviderId: data.serviceProviderId,
            })
          }
          className={cn(
            "shrink-0 rounded-md px-3 py-1 text-sm font-medium",
            "bg-gray-900 text-white hover:bg-gray-700",
            "dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300",
          )}
        >
          Connect
        </button>
      )}
    </div>
  );
}

export default AuthPromptVisualization;
