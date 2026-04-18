import { SignUp } from '@clerk/nextjs';
import Link from 'next/link';
import { Logo } from '@/components/ui';

const clerkDark = {
  variables: {
    colorPrimary: '#6366f1',
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
    fontFamily: 'var(--font-sans), system-ui, sans-serif',
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
      fontFamily: 'var(--font-display), system-ui, sans-serif',
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
      backgroundColor: '#6366f1',
      color: '#fff',
      fontWeight: '600',
    },
    formButtonReset: { color: '#818cf8' },
    dividerLine: { background: 'rgba(255,255,255,0.07)' },
    dividerText: { color: '#52525B' },
    socialButtonsBlockButton: {
      background: '#18181F',
      borderColor: 'rgba(255,255,255,0.1)',
      color: '#FAFAFA',
    },
    socialButtonsBlockButtonText: { color: '#FAFAFA' },
    socialButtonsBlockButtonArrow: { color: '#71717A' },
    footerActionLink: { color: '#818cf8' },
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
    formResendCodeLink: { color: '#818cf8' },
  },
} as const;

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <Link href="/" className="inline-flex mb-8" aria-label="Tendon home">
            <Logo size={32} withWordmark />
          </Link>

          <div className="mb-6">
            <p className="eyebrow mb-2">Get started</p>
            <h1 className="heading text-2xl" style={{ letterSpacing: '-0.02em' }}>
              Create your account
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>
              2-minute setup · No credit card required.
            </p>
          </div>

          <SignUp fallbackRedirectUrl="/onboarding" signInUrl="/login" appearance={clerkDark} />
        </div>
      </div>

      <div
        className="hidden lg:flex flex-1 items-center justify-center p-12 relative border-l overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-soft)' }}
      >
        <div className="absolute inset-0 glow-bg pointer-events-none opacity-60" />
        <div className="grid-bg absolute inset-0 opacity-40" />

        <div className="relative max-w-xs space-y-3">
          <p className="eyebrow mb-4">After signing up, you&apos;ll:</p>
          <p className="text-xs mb-5" style={{ color: 'var(--subtle)' }}>
            After signing up, you&apos;ll get:
          </p>
          {[
            {
              label: 'Step 1 — Run this once',
              content: 'claude mcp add --transport http tendon https://api.tendon.alashed.kz/mcp',
              mono: true,
              accent: true,
            },
            {
              label: 'Step 2 — Say this in Claude Code',
              content: '"Start my day in Tendon: create my first task, start a focus session, and show today plan."',
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
              style={{ borderColor: accent ? 'rgba(99,102,241,0.2)' : 'var(--border)' }}
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
