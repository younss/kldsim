import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { ApiError } from "../lib/apiClient";

export default function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-xl border border-surface-border bg-surface-raised p-8 shadow-2xl">
        <h1 className="mb-1 text-2xl font-semibold text-white">
          KLD<span className="text-brand-400">Sim</span>
        </h1>
        <p className="mb-6 text-sm text-slate-400">Sign in to your simulation workspace.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-surface-border bg-surface px-3 py-2 text-sm text-white outline-none focus:border-brand-500"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-health-critical">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-brand-600 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          New organization?{" "}
          <Link to="/register" className="text-brand-400 hover:underline">
            Create a tenant
          </Link>
        </p>
        <p className="mt-3 rounded-md border border-surface-border bg-surface px-3 py-2 text-center text-[11px] text-slate-500">
          Demo: admin@kldsim.local / facilitator@kldsim.local / player1@kldsim.local — password ChangeMe123!
        </p>
      </div>
    </div>
  );
}
