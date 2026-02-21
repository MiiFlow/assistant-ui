import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, X } from "lucide-react";
import { cn } from "../utils/cn";

export interface ChatHeaderAction {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface ChatHeaderProps {
  /** Assistant/chat title */
  title: string;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Logo URL or element */
  logo?: string | React.ReactNode;
  /** Menu actions */
  actions?: ChatHeaderAction[];
  /** Show close button */
  showClose?: boolean;
  /** Close button handler */
  onClose?: () => void;
  /** Loading state */
  loading?: boolean;
  /** Additional class names */
  className?: string;
  /** Custom styles via CSS variables */
  style?: React.CSSProperties;
}

export function ChatHeader({
  title,
  subtitle,
  logo,
  actions,
  showClose,
  onClose,
  loading,
  className,
  style,
}: ChatHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  // Uses composedPath() to work correctly inside Shadow DOM
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const path = event.composedPath();
      if (
        menuRef.current &&
        !path.includes(menuRef.current) &&
        buttonRef.current &&
        !path.includes(buttonRef.current)
      ) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3",
        "px-4 py-3",
        "border-b border-[var(--chat-border)]",
        "bg-[var(--chat-header-bg,#ffffff)]",
        className
      )}
      style={style}
    >
      {/* Left section: Logo and title */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Logo */}
        {logo && (
          <div className="flex-shrink-0">
            {typeof logo === "string" ? (
              <img
                src={logo}
                alt=""
                className="w-10 h-10 rounded-lg object-contain"
              />
            ) : (
              logo
            )}
          </div>
        )}

        {/* Title and subtitle */}
        <div className="flex flex-col min-w-0">
          {loading ? (
            <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
          ) : (
            <h1 className="text-lg font-semibold text-[var(--chat-text)] truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-[var(--chat-text-subtle)] truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Menu button */}
        {actions && actions.length > 0 && (
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "p-2 rounded-lg",
                "text-[var(--chat-text-subtle)]",
                "hover:bg-[var(--chat-panel-bg)] hover:text-[var(--chat-text)]",
                "transition-colors duration-200"
              )}
              aria-label="Menu"
              aria-expanded={menuOpen}
            >
              <MoreVertical size={18} />
            </button>

            {/* Dropdown menu */}
            {menuOpen && (
              <div
                ref={menuRef}
                className={cn(
                  "absolute right-0 top-full mt-1 z-50",
                  "min-w-[180px]",
                  "bg-white rounded-lg shadow-lg",
                  "border border-[var(--chat-border)]",
                  "py-1",
                  "animate-fade-in"
                )}
              >
                {actions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => {
                      action.onClick();
                      setMenuOpen(false);
                    }}
                    disabled={action.disabled}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2",
                      "text-sm text-left",
                      "text-[var(--chat-text)]",
                      "hover:bg-[var(--chat-panel-bg)]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-colors duration-150"
                    )}
                  >
                    {action.icon && (
                      <span className="flex-shrink-0 text-[var(--chat-text-subtle)]">
                        {action.icon}
                      </span>
                    )}
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Close button */}
        {showClose && onClose && (
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg",
              "text-[var(--chat-text-subtle)]",
              "hover:bg-[var(--chat-panel-bg)] hover:text-[var(--chat-text)]",
              "transition-colors duration-200"
            )}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
