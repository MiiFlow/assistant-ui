import { createContext } from "react";

/** The editor owns command-menu state; other pickers yield to it. */
export const CommandMenuContext = createContext({
  isOpen: false,
  isOpenNow: (): boolean => false,
});
