import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';

const clerkDark = {
  variables: {
    colorPrimary: '#3B82F6',
    colorBackground: '#111115',
    colorText: '#FAFAFA',
    colorTextSecondary: '#A1A1AA',
    colorInputBackground: '#18181F',
    colorInputText: '#FAFAFA',
    colorNeutral: '#52525B',
    colorDanger: '#F87171',
    colorSuccess: '#4ADE80',
    colorWarning: '#FBBF24',
    borderRadius: '8px',
    fontFamily: 'var(--font-outfit), system-ui, sans-serif',
    fontSize: '14px',
  },
  elements: {
    rootBox: { width: '100%' },
    card: {
      background: '#111115',
      boxShadow: '0 0 0 1px rgba(255,255,255,0.07)',
    },
    cardBox: { background: '#111115' },
    headerTitle: {
      fontFamily: 'var(--font-syne), system-ui, sans-serif',
      fontWeight: '700',
      color: '#FAFAFA',
    },
    headerSubtitle: { color: '#A1A1AA' },
    formFieldLabel: { color: '#A1A1AA', fontSize: '12px' },
    formFieldInput: {
      background: '#18181F',
      borderColor: 'rgba(255,255,255,0.1)',
      color: '#FAFAFA',
    },
    formFieldInputShowPasswordButton: { color: '#71717A' },
    formFieldHintText: { color: '#71717A' },
    formFieldErrorText: { color: '#F87171' },
    formFieldSuccessText: { color: '#4ADE80' },
    formFieldWarningText: { color: '#FBBF24' },
    formButtonPrimary: {
      backgroundColor: '#3B82F6',
      color: '#fff',
      fontWeight: '600',
    },
    formButtonReset: { color: '#60A5FA' },
    dividerLine: { background: 'rgba(255,255,255,0.07)' },
    dividerText: { color: '#52525B' },
    socialButtonsBlockButton: {
      background: '#18181F',
      borderColor: 'rgba(255,255,255,0.1)',
      color: '#FAFAFA',
    },
    socialButtonsBlockButtonText: { color: '#FAFAFA' },
    socialButtonsBlockButtonArrow: { color: '#71717A' },
    footerActionLink: { color: '#60A5FA' },
    footerActionText: { color: '#71717A' },
    footer: { background: '#111115', borderTop: '1px solid rgba(255,255,255,0.06)' },
    identityPreviewText: { color: '#FAFAFA' },
    identityPreviewEditButtonIcon: { color: '#A1A1AA' },
    alertText: { color: '#FAFAFA' },
    alert: { background: 'rgba(248,113,113,0.08)', borderColor: 'rgba(248,113,113,0.2)' },
    otpCodeFieldInput: {
      background: '#18181F',
      borderColor: 'rgba(255,255,255,0.1)',
      color: '#FAFAFA',
    },
    formResendCodeLink: { color: '#60A5FA' },
  },
} as const;

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── SignUp side ─────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="font-display font-bold text-lg mb-8 block text-center">
            <span style={{ color: 'var(--accent)' }}>tendon</span>
            <span style={{ color: 'var(--muted)' }}>.</span>
          </Link>

          <SignUp
            fallbackRedirectUrl="/onboarding"
            signInUrl="/login"
            appearance={clerkDark}
          />
        </div>
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
              'radial-gradient(ellipse at 30% 50%, rgba(59,130,246,0.06) 0%, transparent 65%)',
          }}
        />
        <div className="relative max-w-xs space-y-3 animate-fade-in delay-300">
          <p className="text-xs mb-5" style={{ color: 'var(--subtle)' }}>
            After signing up, you&apos;ll get:
          </p>
          {[
            {
              label: 'Step 1 — Run this once',
              content: 'claude mcp add --transport http tendon https://mcp.tendon.alashed.kz/mcp',
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
              style={{ borderColor: accent ? 'rgba(59,130,246,0.2)' : 'var(--border)' }}
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
