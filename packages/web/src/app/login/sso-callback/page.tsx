import { AuthenticateWithRedirectCallback } from '@clerk/nextjs';
import { Logo } from '@/components/ui';

export default function SSOCallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <Logo size={44} variant="gradient" />
        <div>
          <p className="eyebrow mb-1.5">Signing you in</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Verifying your session with the provider…
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-light)', animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-light)', animationDelay: '160ms' }} />
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-light)', animationDelay: '320ms' }} />
        </div>
      </div>
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/onboarding"
      />
    </div>
  );
}
