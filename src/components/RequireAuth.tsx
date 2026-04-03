import { ReactNode, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

type Props = {
  children: ReactNode;
};

const RequireAuth = ({ children }: Props) => {
  const { authState, isAuthenticated, refreshAuth } = useAuth();

  useEffect(() => {
    if (authState === "loading" || isAuthenticated) return;
    refreshAuth().catch(() => undefined);
  }, [authState, isAuthenticated, refreshAuth]);

  if (authState === "loading") return <div className="container mx-auto px-4 py-10 text-sm text-muted-foreground">Validating session...</div>;
  if (!isAuthenticated) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

export default RequireAuth;
