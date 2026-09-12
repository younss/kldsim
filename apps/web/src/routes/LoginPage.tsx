import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { ApiError } from "../lib/apiClient";
import { AuthBackdrop } from "../components/layout/AuthBackdrop";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-brand-400 focus:bg-white/[0.05] focus:ring-2 focus:ring-brand-500/20";

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
    <AuthBackdrop>
      <div className="rounded-2xl border border-white/[0.08] bg-surface-raised/80 p-8 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-violet-500 text-base font-bold shadow-[0_0_20px_rgba(74,168,255,0.5)]">
            K
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            KLD<span className="bg-gradient-to-r from-brand-300 to-violet-300 bg-clip-text text-transparent">Sim</span>
          </h1>
        </div>
        <p className="mb-6 text-sm text-slate-400">Sign in to your simulation workspace.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-sm text-health-critical">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 py-2.5 text-sm font-medium text-white shadow-[0_4px_16px_-4px_rgba(74,168,255,0.5)] transition-all hover:shadow-[0_6px_20px_-4px_rgba(74,168,255,0.65)] disabled:opacity-50"
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
        <p className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-center text-[11px] text-slate-500">
          Demo: admin@kldsim.local / facilitator@kldsim.local / player1@kldsim.local — password ChangeMe123!
        </p>
      </div>
    </AuthBackdrop>
  );
}
