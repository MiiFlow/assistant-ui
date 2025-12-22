import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes with proper precedence.
 * Combines clsx for conditional classes with tailwind-merge for conflict resolution.
 *
 * @example
 * cn("px-4 py-2", "px-6") // => "py-2 px-6"
 * cn("text-red-500", isActive && "text-blue-500") // => "text-blue-500" when isActive
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
