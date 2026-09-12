import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../state/authStore";
import { ApiError } from "../lib/apiClient";
import { AuthBackdrop } from "../components/layout/AuthBackdrop";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-brand-400 focus:bg-white/[0.05] focus:ring-2 focus:ring-brand-500/20";

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();
  const [form, setForm] = useState({ tenantName: "", displayName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthBackdrop>
      <div className="rounded-2xl border border-white/[0.08] bg-surface-raised/80 p-8 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_24px_60px_-16px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">Create your workspace</h1>
        <p className="mb-6 text-sm text-slate-400">You'll be the first platform admin for this tenant.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Organization name" value={form.tenantName} onChange={(v) => update("tenantName", v)} placeholder="Acme Bank" />
          <Field label="Your name" value={form.displayName} onChange={(v) => update("displayName", v)} placeholder="Jordan Lee" />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="you@company.com" />
          <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} placeholder="At least 10 characters" />
          {error && <p className="text-sm text-health-critical">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 py-2.5 text-sm font-medium text-white shadow-[0_4px_16px_-4px_rgba(74,168,255,0.5)] transition-all hover:shadow-[0_6px_20px_-4px_rgba(74,168,255,0.65)] disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create workspace"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-400 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthBackdrop>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>
      <input type={type} required value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputClass} />
    </div>
  );
}
