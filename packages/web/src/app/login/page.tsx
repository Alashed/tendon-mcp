import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── SignIn side ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="font-display font-bold text-lg mb-10 self-start max-w-sm w-full">
          <span style={{ color: 'var(--accent)' }}>tendon</span>
          <span style={{ color: 'var(--muted)' }}>.</span>
        </Link>

        <SignIn
          fallbackRedirectUrl="/dashboard"
          signUpUrl="/register"
          appearance={{
            variables: {
              colorPrimary: '#F59E0B',
              colorBackground: '#111115',
              colorText: '#FAFAFA',
              colorTextSecondary: '#71717A',
              colorInputBackground: '#18181F',
              colorInputText: '#FAFAFA',
              colorNeutral: '#71717A',
              borderRadius: '8px',
              fontFamily: 'var(--font-outfit), system-ui, sans-serif',
            },
            elements: {
              card: {
                boxShadow: '0 0 0 1px rgba(255,255,255,0.07)',
                background: '#111115',
              },
              formButtonPrimary: {
                backgroundColor: '#F59E0B',
                color: '#000',
                fontWeight: '600',
              },
              footerActionLink: { color: '#F59E0B' },
              headerTitle: {
                fontFamily: 'var(--font-syne), system-ui, sans-serif',
                fontWeight: '700',
              },
            },
          }}
        />
      </div>

      {/* ── Decorative side ─────────────────────────── */}
      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12 relative border-l"
        style={{ borderColor: 'var(--border)' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 30% 50%, rgba(245,158,11,0.06) 0%, transparent 65%)',
          }}
        />
        <div className="relative max-w-sm animate-fade-in delay-300">
          <div className="terminal-cmd text-sm leading-relaxed">
            <div className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Claude Code · Tendon MCP
            </div>
            <div className="space-y-3">
              <div>
                <span style={{ color: 'var(--muted)' }}>You: </span>
                What should I work on today?
              </div>
              <div style={{ color: 'var(--accent-light)' }}>
                <span style={{ color: 'var(--accent)' }}>Claude: </span>
                You have 3 in-progress tasks. The auth bug is highest priority — you flagged it as
                blocking yesterday.
              </div>
            </div>
          </div>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--subtle)' }}>
            This is what Claude sees after connecting Tendon
          </p>
        </div>
      </div>
    </div>
  );
}
