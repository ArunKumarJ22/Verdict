import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-loading">
        <div className="auth-loading-spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!session) {
    // Replace history entry so back-button doesn't loop
    window.location.replace("/login");
    return null;
  }

  return children;
}
