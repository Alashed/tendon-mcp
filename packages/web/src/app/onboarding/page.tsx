'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@clerk/nextjs';
import { Logo } from '@/components/ui';

const COMMAND = 'claude mcp add --transport http tendon https://api.tendon.alashed.kz/mcp';
const FIRST_PROMPT = 'Start my day in Tendon: create my first task, start a focus session, and show today plan.';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.tendon.alashed.kz';

type FlowStep = 'connect' | 'first_action' | 'first_value';
type StatusKey = 'not_started' | 'waiting_connect' | 'connected' | 'waiting_first_call' | 'first_value';

interface FirstValueSnapshot {
  taskCount: number;
  trackedMinutes: number;
}

interface FirstValueCheckResult extends FirstValueSnapshot {
  hasFirstValue: boolean;
}

interface OnboardingStatusResponse {
  connected: boolean;
  workspace_id: string | null;
  first_value_achieved: boolean;
  first_value_source: 'event' | 'workspace_data' | null;
}

function getStatusIndex(status: StatusKey): number {
  const order: StatusKey[] = ['not_started', 'waiting_connect', 'connected', 'waiting_first_call', 'first_value'];
  return order.indexOf(status);
}

export default function OnboardingPage() {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [step, setStep] = useState<FlowStep>('connect');
  const [status, setStatus] = useState<StatusKey>('not_started');
  const [copied, setCopied] = useState<'cmd' | 'prompt' | null>(null);
  const [checking, setChecking] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [snapshot, setSnapshot] = useState<FirstValueSnapshot>({ taskCount: 0, trackedMinutes: 0 });
  const emittedEvents = useRef(new Set<string>());

  const displayName = useMemo(
    () => user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there',
    [user],
  );

  const trackEvent = useCallback(async (eventName: string, properties?: Record<string, unknown>) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API_URL}/events/onboarding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          event_name: eventName,
          properties,
        }),
      });
    } catch {
      // no-op: analytics must not block activation
    }
  }, [getToken]);

  const trackEventOnce = useCallback(async (eventName: string, properties?: Record<string, unknown>) => {
    if (emittedEvents.current.has(eventName)) return;
    emittedEvents.current.add(eventName);
    await trackEvent(eventName, properties);
  }, [trackEvent]);

  const copy = async (target: 'cmd' | 'prompt') => {
    await navigator.clipboard.writeText(target === 'cmd' ? COMMAND : FIRST_PROMPT);
    setCopied(target);
    if (target === 'cmd') {
      void trackEventOnce('command_copied');
    }
    setTimeout(() => setCopied(null), 2200);
  };

  const checkFirstValue = useCallback(async (token: string, workspaceId: string): Promise<FirstValueCheckResult> => {
    const today = new Date().toISOString().split('T')[0];
    const [tasksRes, activitiesRes] = await Promise.all([
      fetch(`${API_URL}/tasks?workspace_id=${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${API_URL}/activities?workspace_id=${workspaceId}&date=${today}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    if (!tasksRes.ok || !activitiesRes.ok) return { hasFirstValue: false, taskCount: 0, trackedMinutes: 0 };

    const [{ data: tasks }, { data: activities }] = await Promise.all([tasksRes.json(), activitiesRes.json()]);
    const taskCount = (tasks as { status: string }[]).filter((task) => task.status !== 'archived').length;
    const trackedMinutes = Math.floor(
      (activities as { start_time: string; end_time: string | null }[])
        .filter((activity) => activity.end_time)
        .reduce((acc, activity) => {
          return acc + (new Date(activity.end_time!).getTime() - new Date(activity.start_time).getTime()) / 1000;
        }, 0) / 60,
    );

    setSnapshot({ taskCount, trackedMinutes });
    return {
      hasFirstValue: taskCount > 0 || trackedMinutes > 0,
      taskCount,
      trackedMinutes,
    };
  }, []);

  const syncFlowState = useCallback(async () => {
    setChecking(true);
    try {
      const token = await getToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/auth/claude-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;

      const { data } = await res.json();
      const isConnected = Boolean(data?.connected);
      const workspaceId = (data?.workspace_id as string | null) ?? null;
      setConnected(isConnected);

      if (!isConnected) {
        setStatus('waiting_connect');
        setStep('connect');
        return;
      }

      if (!workspaceId) {
        setStatus('connected');
        setStep('first_action');
        return;
      }

      setStatus('connected');
      void trackEventOnce('mcp_connected', { workspace_id: workspaceId });
      void trackEventOnce('oauth_completed', { workspace_id: workspaceId });

      const onboardingStatusRes = await fetch(`${API_URL}/events/onboarding/status?workspace_id=${workspaceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onboardingStatusRes.ok) {
        const { data: onboardingStatus } = await onboardingStatusRes.json() as { data: OnboardingStatusResponse };
        if (onboardingStatus.first_value_achieved) {
          const valueCheck = await checkFirstValue(token, workspaceId);
          setStatus('first_value');
          setStep('first_value');
          void trackEventOnce('first_value_achieved', {
            workspace_id: workspaceId,
            source: onboardingStatus.first_value_source ?? 'event',
            task_count: valueCheck.taskCount,
            tracked_minutes: valueCheck.trackedMinutes,
          });
          if (valueCheck.taskCount > 0) void trackEventOnce('first_task_created', { workspace_id: workspaceId });
          if (valueCheck.trackedMinutes > 0) void trackEventOnce('first_focus_started', { workspace_id: workspaceId });
          return;
        }
      }

      const valueCheck = await checkFirstValue(token, workspaceId);
      if (valueCheck.hasFirstValue) {
        setStatus('first_value');
        setStep('first_value');
        void trackEventOnce('first_value_achieved', {
          workspace_id: workspaceId,
          source: 'workspace_data',
          task_count: valueCheck.taskCount,
          tracked_minutes: valueCheck.trackedMinutes,
        });
        if (valueCheck.taskCount > 0) void trackEventOnce('first_task_created', { workspace_id: workspaceId });
        if (valueCheck.trackedMinutes > 0) void trackEventOnce('first_focus_started', { workspace_id: workspaceId });
      } else {
        setStatus('waiting_first_call');
        setStep('first_action');
      }
    } catch {
      // ignore network issues, user can retry
    } finally {
      setChecking(false);
    }
  }, [checkFirstValue, getToken, trackEventOnce]);

  useEffect(() => {
    void syncFlowState();
    void trackEventOnce('onboarding_opened');
  }, [syncFlowState, trackEventOnce]);

  useEffect(() => {
    if (step === 'first_value') return;
    const interval = setInterval(() => {
      void syncFlowState();
    }, 10_000);
    return () => clearInterval(interval);
  }, [step, syncFlowState]);

  const current = getStatusIndex(status);
  const flowStatuses: Array<{ key: StatusKey; label: string }> = [
    { key: 'not_started', label: 'Not started' },
    { key: 'waiting_connect', label: 'Waiting for connection' },
    { key: 'connected', label: 'Connected' },
    { key: 'waiting_first_call', label: 'Waiting for first action' },
    { key: 'first_value', label: 'First value reached' },
  ];

  useEffect(() => {
    if (step === 'first_action') {
      void trackEventOnce('first_prompt_shown');
    }
  }, [step, trackEventOnce]);

  const StatusList = (
    <div className="rounded-xl p-5" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.14)' }}>
      <p className="eyebrow mb-3">Activation status</p>
      <div className="space-y-2">
        {flowStatuses.map(({ key, label }) => {
          const idx = getStatusIndex(key);
          const done = idx < current;
          const active = idx === current;
          return (
            <div key={key} className="flex items-center gap-3 text-sm">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px]"
                style={{
                  background: done ? 'rgba(16,185,129,0.15)' : active ? 'rgba(99,102,241,0.2)' : 'transparent',
                  border: `1px solid ${done ? 'rgba(16,185,129,0.5)' : active ? 'rgba(99,102,241,0.55)' : 'var(--dim)'}`,
                  color: done ? '#6ee7b7' : active ? 'var(--accent-light)' : 'var(--subtle)',
                }}
              >
                {done ? '✓' : active ? '●' : ''}
              </span>
              <span style={{ color: active ? 'var(--text)' : done ? 'var(--text-soft)' : 'var(--muted)' }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const wizardSteps: Array<{ key: FlowStep; label: string }> = [
    { key: 'connect', label: 'Connect' },
    { key: 'first_action', label: 'First action' },
    { key: 'first_value', label: 'Activated' },
  ];
  const currentStepIndex = wizardSteps.findIndex((s) => s.key === step);
  const progressPct = Math.min(100, ((currentStepIndex + (status === 'first_value' ? 1 : 0.5)) / wizardSteps.length) * 100);

  const WizardShell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="absolute inset-0 glow-bg pointer-events-none" />
      <div className="grid-bg absolute inset-0 opacity-40" />

      <header className="relative border-b backdrop-blur-md" style={{ borderColor: 'var(--border)', background: 'rgba(8, 8, 11, 0.72)' }}>
        <div className="container-narrow py-4 flex items-center justify-between">
          <Link href="/" className="inline-flex" aria-label="Tendon home">
            <Logo size={26} withWordmark wordmarkSize="sm" />
          </Link>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            Step {currentStepIndex + 1} of {wizardSteps.length}
          </div>
        </div>
        {/* step indicators */}
        <div className="container-narrow pb-4">
          <div className="flex items-center gap-2">
            {wizardSteps.map((s, i) => {
              const done = i < currentStepIndex || (i === currentStepIndex && step === 'first_value');
              const active = i === currentStepIndex && step !== 'first_value';
              return (
                <div key={s.key} className="flex-1 flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 text-xs"
                    style={{ color: active ? 'var(--text)' : done ? 'var(--accent-light)' : 'var(--muted)' }}
                  >
                    <span
                      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold"
                      style={{
                        background: done
                          ? 'rgba(16,185,129,0.15)'
                          : active
                            ? 'rgba(99,102,241,0.2)'
                            : 'var(--surface)',
                        border: `1px solid ${done ? 'rgba(16,185,129,0.5)' : active ? 'rgba(99,102,241,0.55)' : 'var(--border)'}`,
                        color: done ? '#6ee7b7' : active ? 'var(--accent-light)' : 'var(--subtle)',
                      }}
                    >
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {i < wizardSteps.length - 1 && (
                    <div className="flex-1 h-px" style={{ background: done ? 'rgba(16,185,129,0.4)' : 'var(--border)' }} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)',
              }}
            />
          </div>
        </div>
      </header>

      <div className="relative flex-1 flex items-start justify-center py-12">
        <div className="container-narrow">{children}</div>
      </div>
    </div>
  );

  if (step === 'connect') {
    return (
      <WizardShell>
        <div>
          <div className="mb-8">
            <h1 className="display-2 mb-3">Welcome, {displayName}.</h1>
            <p className="text-base" style={{ color: 'var(--muted)' }}>
              Connect Claude Code so Tendon can start tracking real execution data.
            </p>
          </div>

          <div className="card-elev p-6 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge badge-accent">1</span>
              <p className="text-sm font-medium">Run once in terminal</p>
            </div>
            <div className="flex items-start gap-2 px-3 py-3 rounded-lg mb-3 overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)' }}>
              <span className="text-sm shrink-0 mt-0.5 font-mono" style={{ color: 'var(--subtle)' }}>$</span>
              <code className="text-xs flex-1 whitespace-nowrap select-all font-mono" style={{ color: 'var(--accent-light)' }}>{COMMAND}</code>
            </div>
            <button
              onClick={() => copy('cmd')}
              className="btn-ghost w-full justify-center"
              style={
                copied === 'cmd'
                  ? { borderColor: 'rgba(99,102,241,0.45)', color: 'var(--accent-light)', background: 'rgba(99,102,241,0.08)' }
                  : undefined
              }
            >
              {copied === 'cmd' ? '✓ Copied' : 'Copy command'}
            </button>
            <p className="text-xs mt-3" style={{ color: 'var(--subtle)' }}>
              Then restart Claude Code — MCP tools load only at startup.
            </p>
          </div>

          <div className="card p-6 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="badge">2</span>
              <p className="text-sm font-medium">In Claude chat, send:</p>
            </div>
            <p className="text-sm font-mono mb-3 leading-relaxed" style={{ color: 'var(--accent-light)' }}>
              {FIRST_PROMPT}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Claude opens browser auth if needed. After that, Tendon checks the connection automatically.
            </p>
          </div>

          <div className="mb-6">{StatusList}</div>

          <button
            onClick={syncFlowState}
            disabled={checking}
            className="btn-primary w-full"
          >
            {checking ? 'Checking…' : connected ? 'Connected — continue →' : 'Check connection'}
          </button>
        </div>
      </WizardShell>
    );
  }

  if (step === 'first_action') {
    return (
      <WizardShell>
        <div>
          <div className="mb-8">
            <div className="badge badge-success mb-4">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse-soft" style={{ background: 'var(--success)' }} />
              Claude connected
            </div>
            <h1 className="display-2 mb-3">Run your first action.</h1>
            <p className="text-base" style={{ color: 'var(--muted)' }}>
              One prompt creates your first task, starts a focus session, and generates today&apos;s plan.
            </p>
          </div>

          <div className="card-elev p-6 mb-5">
            <p className="eyebrow mb-3">Send this in Claude</p>
            <div className="rounded-lg px-4 py-4 mb-4" style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.22)' }}>
              <p className="text-sm font-mono leading-relaxed" style={{ color: 'var(--accent-light)' }}>
                {FIRST_PROMPT}
              </p>
            </div>
            <button
              onClick={() => {
                void copy('prompt');
                void trackEventOnce('first_prompt_sent', { from: 'onboarding_first_action' });
              }}
              className="btn-ghost w-full justify-center"
              style={
                copied === 'prompt'
                  ? { borderColor: 'rgba(99,102,241,0.45)', color: 'var(--accent-light)', background: 'rgba(99,102,241,0.08)' }
                  : undefined
              }
            >
              {copied === 'prompt' ? '✓ Copied' : 'Copy first prompt'}
            </button>
          </div>

          <div className="mb-5">{StatusList}</div>

          <button onClick={syncFlowState} disabled={checking} className="btn-primary w-full">
            {checking ? 'Checking…' : 'I sent it — check first value'}
          </button>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--subtle)' }}>
            Tendon also auto-checks every 10 seconds.
          </p>
        </div>
      </WizardShell>
    );
  }

  return (
    <WizardShell>
      <div>
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4.5 4.5L19 7" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="display-2 mb-3">First value reached.</h1>
          <p className="text-base" style={{ color: 'var(--muted)' }}>
            Tendon now tracks execution data from your Claude workflow.
          </p>
        </div>

        <div className="card-elev p-6 mb-5">
          <p className="eyebrow mb-4">First run results</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>
              <div className="font-display text-3xl font-semibold mb-1 tracking-tighter" style={{ color: snapshot.taskCount > 0 ? 'var(--accent-light)' : 'var(--subtle)' }}>
                {snapshot.taskCount}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Active tasks</div>
            </div>
            <div className="rounded-xl px-4 py-4" style={{ background: 'var(--bg-soft)', border: '1px solid var(--border)' }}>
              <div className="font-display text-3xl font-semibold mb-1 tracking-tighter" style={{ color: snapshot.trackedMinutes > 0 ? 'var(--text)' : 'var(--subtle)' }}>
                {snapshot.trackedMinutes}<span className="text-xl" style={{ color: 'var(--muted)' }}>m</span>
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>Focus tracked today</div>
            </div>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Continue work in Claude. Tendon will keep context and build your daily summary automatically.
          </p>
        </div>

        <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.14)' }}>
          <p className="eyebrow mb-2">Resume prompt</p>
          <p className="text-sm font-mono leading-relaxed" style={{ color: 'var(--accent-light)' }}>
            Continue where I stopped yesterday and suggest my next highest-impact step.
          </p>
        </div>

        <Link href="/dashboard" className="btn-accent w-full">
          Open dashboard →
        </Link>
      </div>
    </WizardShell>
  );
}
