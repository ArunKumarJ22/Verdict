import { useEffect, useState } from "react";
import LoginPage        from "./pages/LoginPage";
import SignupPage       from "./pages/SignupPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import App              from "./App";
import ProtectedRoute   from "./components/ProtectedRoute";

function getPath() {
  return window.location.pathname;
}

export default function Router() {
  const [path, setPath] = useState(getPath());

  useEffect(() => {
    // Listen for popstate (back/forward) and our manual pushes
    const handler = () => setPath(getPath());
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  if (path === "/login")          return <LoginPage />;
  if (path === "/signup")         return <SignupPage />;
  if (path === "/reset-password") return <ResetPasswordPage />;

  // Everything else is protected
  return (
    <ProtectedRoute>
      <App />
    </ProtectedRoute>
  );
}
