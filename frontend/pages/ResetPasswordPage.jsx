import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function ResetPasswordPage() {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [sent, setSent]         = useState(false);
  const [loading, setLoading]   = useState(false);

  // Supabase redirects here with #access_token in the URL after reset email click
  const isSettingNew = window.location.hash.includes("access_token");

  async function handleRequest(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });

    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  async function handleSetNew(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8)  { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) setError(error.message);
    else window.location.replace("/");
  }

  // ── Set new password view ──────────────────────────────────
  if (isSettingNew) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-icon">V</div>
            <div><div className="auth-brand-name">Verdict</div><div className="auth-brand-sub">Document Intelligence</div></div>
          </div>
          <h1 className="auth-title">Set new password</h1>
          <p className="auth-subtitle">Choose a strong password for your account</p>
          <form onSubmit={handleSetNew} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">New password</label>
              <input className="auth-input" type="password" placeholder="Min. 8 characters"
                value={password} onChange={e => setPassword(e.target.value)} required />
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm new password</label>
              <input className="auth-input" type="password" placeholder="Repeat password"
                value={confirm} onChange={e => setConfirm(e.target.value)} required />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button className="btn-auth-primary" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Set new password"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Request reset email view ───────────────────────────────
  if (sent) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="auth-brand-icon">V</div>
            <div><div className="auth-brand-name">Verdict</div><div className="auth-brand-sub">Document Intelligence</div></div>
          </div>
          <div className="auth-success-box">
            <div className="auth-success-icon">✓</div>
            <h2 className="auth-title" style={{ marginTop: 12 }}>Email sent</h2>
            <p className="auth-subtitle">Check <strong>{email}</strong> for a password reset link.</p>
          </div>
          <p className="auth-footer"><a className="auth-link" href="/login">Back to sign in</a></p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-icon">V</div>
          <div><div className="auth-brand-name">Verdict</div><div className="auth-brand-sub">Document Intelligence</div></div>
        </div>
        <h1 className="auth-title">Reset your password</h1>
        <p className="auth-subtitle">Enter your email and we'll send you a reset link</p>
        <form onSubmit={handleRequest} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button className="btn-auth-primary" type="submit" disabled={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <p className="auth-footer"><a className="auth-link" href="/login">Back to sign in</a></p>
      </div>
    </div>
  );
}
