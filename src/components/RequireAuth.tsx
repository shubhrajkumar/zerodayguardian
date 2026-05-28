import { ReactNode } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";

type Props = {
  children: ReactNode;
};

const RequireAuth = ({ children }: Props) => {
  return <ProtectedRoute>{children}</ProtectedRoute>;
};

export default RequireAuth;
