import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── SignUp side ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Link href="/" className="font-display font-bold text-lg mb-10 self-start max-w-sm w-full">
          <span style={{ color: 'var(--accent)' }}>tendon</span>
          <span style={{ color: 'var(--muted)' }}>.</span>
        </Link>

        <SignUp
          fallbackRedirectUrl="/onboarding"
          signInUrl="/login"
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

      {/* ── Preview side ─────────────────────────────── */}
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
        <div className="relative max-w-xs space-y-3 animate-fade-in delay-300">
          <p className="text-xs mb-5" style={{ color: 'var(--subtle)' }}>
            After signing up, you&apos;ll get:
          </p>
          {[
            {
              label: 'Step 1 — Run this once',
              content:
                'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz',
              mono: true,
              accent: true,
            },
            {
              label: 'Step 2 — Say this in Claude Code',
              content: '"Create a task: implement refresh token, high priority"',
              mono: false,
              accent: false,
            },
            {
              label: 'Claude responds',
              content: '✓ Task created · #1 · High priority · Added to your workspace',
              mono: false,
              accent: true,
            },
          ].map(({ label, content, mono, accent }) => (
            <div
              key={label}
              className="card p-4"
              style={{ borderColor: accent ? 'rgba(245,158,11,0.2)' : 'var(--border)' }}
            >
              <p className="text-xs mb-2" style={{ color: 'var(--subtle)' }}>
                {label}
              </p>
              <p
                className={`text-xs leading-relaxed break-all ${mono ? 'font-mono' : ''}`}
                style={{ color: accent ? 'var(--accent-light)' : 'var(--text)' }}
              >
                {content}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
