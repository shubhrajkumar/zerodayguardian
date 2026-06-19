import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useZdg } from "@/context/ZdgContext";

type ProtectedRouteProps = {
  children: ReactNode;
};

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();
  const { isAuthenticated: zdgIsAuth, isLoading: zdgLoading } = useZdg();

  const authReady = !isLoading && !zdgLoading;
  const isAuthed = isAuthenticated || zdgIsAuth;

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
