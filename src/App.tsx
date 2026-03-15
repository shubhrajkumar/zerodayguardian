import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as HotToaster } from "react-hot-toast";
import { Toaster as SonnerToaster } from "sonner";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import ToolsPage from "./pages/ToolsPage";
import ToolDetail from "./pages/ToolDetail";
import LearnPage from "./pages/LearnPage";
import LabPage from "./pages/LabPage";
import BlogPage from "./pages/BlogPage";
import BlogDetail from "./pages/BlogDetail";
import ResourcesPage from "./pages/ResourcesPage";
import CommunityPage from "./pages/CommunityPage";
import AboutPage from "./pages/AboutPage";
import AuthPage from "./pages/AuthPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";
import RequireAuth from "./components/RequireAuth";
import { clearAnonymousClientState, getStoredAccessToken } from "./lib/apiClient";
import { UserProgressProvider } from "./context/UserProgressContext";
import { AuthProvider } from "./context/AuthContext";

const queryClient = new QueryClient();

export default function App() {
  useEffect(() => {
    if (getStoredAccessToken()) return;
    clearAnonymousClientState();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserProgressProvider>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true,
            }}
          >
            <Layout>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/tools/:id" element={<ToolDetail />} />
                <Route path="/learn" element={<LearnPage />} />
                <Route path="/lab" element={<LabPage />} />
                <Route path="/blog" element={<BlogPage />} />
                <Route path="/blog/:slug" element={<BlogDetail />} />
                <Route path="/resources" element={<ResourcesPage />} />
                <Route path="/community" element={<CommunityPage />} />
                <Route path="/about" element={<AboutPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <DashboardPage />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>

            <HotToaster />
            <SonnerToaster />
          </BrowserRouter>
        </UserProgressProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
