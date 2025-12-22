import { forwardRef } from "react";
import { Bot, User } from "lucide-react";
import { Avatar as AvatarPrimitive, type AvatarProps as AvatarPrimitiveProps } from "../primitives";
import { cn } from "../utils/cn";
import type { ParticipantRole } from "../types";

export interface AvatarProps extends Omit<AvatarPrimitiveProps, "fallback"> {
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-6 h-6 text-xs",
  md: "w-8 h-8 text-sm",
  lg: "w-10 h-10 text-base",
};

const iconSizes = {
  sm: 14,
  md: 16,
  lg: 20,
};

function getRoleIcon(role: ParticipantRole | undefined, size: "sm" | "md" | "lg") {
  const iconSize = iconSizes[size];

  switch (role) {
    case "assistant":
      return <Bot size={iconSize} />;
    case "user":
      return <User size={iconSize} />;
    default:
      return <User size={iconSize} />;
  }
}

/**
 * Styled Avatar component with role-based icons.
 */
export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, src, alt, role, size = "md", className, ...props }, ref) => {
    return (
      <AvatarPrimitive
        ref={ref}
        name={name}
        src={src}
        alt={alt}
        role={role}
        className={cn(
          "rounded-full overflow-hidden flex-shrink-0",
          "flex items-center justify-center",
          "font-medium",
          role === "assistant"
            ? "bg-primary/10 text-primary"
            : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300",
          sizeClasses[size],
          className
        )}
        fallback={getRoleIcon(role, size)}
        {...props}
      />
    );
  }
);

Avatar.displayName = "Avatar";
