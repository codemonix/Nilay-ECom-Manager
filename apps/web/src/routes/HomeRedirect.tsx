import { Navigate } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { getFirstAccessiblePath, type NavItem } from "../config/navItems";

/**
 * Sends the user to the first page (in drawer order, or among `candidates`)
 * they can open, and to /no-access only when there is none -- never to a
 * hardcoded page the user may not have.
 */
export function HomeRedirect({ candidates }: { candidates?: NavItem[] }) {
  const user = useAppSelector((state) => state.auth.user);
  return <Navigate to={getFirstAccessiblePath(user, candidates) ?? "/no-access"} replace />;
}
