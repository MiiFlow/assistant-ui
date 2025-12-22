import { forwardRef, type HTMLAttributes } from "react";
import type { ParticipantRole } from "../types";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  /** Name for fallback initials */
  name?: string;
  /** Image URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Participant role for styling */
  role?: ParticipantRole;
  /** Fallback content when no image or name */
  fallback?: React.ReactNode;
}

/**
 * Get initials from a name.
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Headless Avatar primitive.
 * Renders an image or fallback initials.
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, src, alt, role, fallback, children, ...props }, ref) => {
    const initials = name ? getInitials(name) : null;
    const altText = alt ?? name ?? role ?? "Avatar";

    return (
      <div ref={ref} data-role={role} {...props}>
        {children ?? (
          <>
            {src ? (
              <img src={src} alt={altText} style={{ width: "100%", height: "100%" }} />
            ) : (
              fallback ?? initials ?? role?.charAt(0).toUpperCase()
            )}
          </>
        )}
      </div>
    );
  }
);

Avatar.displayName = "Avatar";
