import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useZdg } from "@/context/ZdgContext";

type ProtectedRouteProps = {
  children: ReactNode;
};

/**
 * Check for mock auth synchronously so protected routes don't redirect
 * before the async auth initialization completes.
 */
const hasMockAuth = (): boolean => {
  try {
    return localStorage.getItem("zdg_mock_auth") === "true";
  } catch {
    return false;
  }
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAuthenticated: zdgIsAuth, isLoading: zdgLoading } = useZdg();

  // If mock auth is set, skip the loading gate — treat the user as authenticated
  // even before the async AuthContext finishes initializing. This prevents a flash
  // redirect to /auth on protected routes during local development / E2E testing.
  const mockEnabled = hasMockAuth();

  const authReady = mockEnabled || (!isLoading && !zdgLoading);
  const isAuthed = mockEnabled || isAuthenticated || zdgIsAuth;

  if (!authReady) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="spinner-cyber spinner-lg" aria-label="Loading" />
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
