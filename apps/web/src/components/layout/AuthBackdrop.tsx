import type { PropsWithChildren } from "react";

/** Shared glow-orb backdrop for the login/register screens. */
export function AuthBackdrop({ children }: PropsWithChildren) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-500/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-violet-600/20 blur-[100px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[32rem] w-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/5 blur-[120px]" />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
