import { useContext } from "react";
import { ColorModeContext, type ColorModeContextValue } from "./colorModeStore";

export function useColorMode(): ColorModeContextValue {
  const context = useContext(ColorModeContext);
  if (!context) throw new Error("useColorMode must be used within a ColorModeProvider");
  return context;
}
