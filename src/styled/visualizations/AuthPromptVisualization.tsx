import { useCallback, useEffect, useState } from "react";

interface AuthPromptData {
  provider: string;
  providerName: string;
  providerLogo: string;
  reason: string;
  serviceProviderId?: string;
  authMethods?: Array<{ id: string; name: string; authType: string }>;
}

interface AuthPromptVisualizationProps {
  data: AuthPromptData;
  config?: any;
  isStreaming?: boolean;
}

/**
 * Compact auth prompt: [logo] Provider Name — [Connect button]
 *
 * When "Connect" is clicked, dispatches a CustomEvent("auth-prompt-connect")
 * so the host app can open its own OAuth dialog (e.g., ManageServiceAccountDialog).
 *
 * Listens for window "OAUTH_SUCCESS" postMessage to show success state.
 */
export function AuthPromptVisualization({ data }: AuthPromptVisualizationProps) {
  const { providerName, providerLogo, serviceProviderId, authMethods } = data;
  const [connected, setConnected] = useState(false);

  // Listen for OAuth success
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "OAUTH_SUCCESS") {
        setConnected(true);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleConnect = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent("auth-prompt-connect", {
        detail: {
          serviceProviderId,
          providerName,
          authMethods,
        },
      }),
    );
  }, [serviceProviderId, providerName, authMethods]);

  if (connected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 8,
          backgroundColor: "var(--chat-success-bg, #dcfce7)",
          color: "var(--chat-success-text, #166534)",
          fontSize: 14,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
        <span>{providerName} connected</span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
        borderRadius: 8,
        border: "1px solid var(--chat-border, #e5e7eb)",
        backgroundColor: "var(--chat-card-bg, #fafafa)",
      }}
    >
      {/* Provider logo */}
      {providerLogo && (
        <img
          src={providerLogo}
          alt={providerName}
          width={28}
          height={28}
          style={{ objectFit: "contain", flexShrink: 0, borderRadius: 4 }}
        />
      )}

      {/* Provider name */}
      <span
        style={{
          flex: 1,
          fontSize: 14,
          fontWeight: 500,
          color: "var(--chat-text, #1f2937)",
        }}
      >
        {providerName}
      </span>

      {/* Connect button */}
      <button
        onClick={handleConnect}
        style={{
          padding: "6px 16px",
          borderRadius: 6,
          border: "none",
          backgroundColor: "var(--chat-primary, #2563eb)",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          cursor: "pointer",
          flexShrink: 0,
          lineHeight: "20px",
        }}
        onMouseOver={(e) => { (e.target as HTMLElement).style.opacity = "0.9"; }}
        onMouseOut={(e) => { (e.target as HTMLElement).style.opacity = "1"; }}
      >
        Connect
      </button>
    </div>
  );
}
