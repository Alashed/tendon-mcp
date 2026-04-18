'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, useUser } from '@clerk/nextjs';

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

  if (step === 'connect') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(59,130,246,0.07) 0%, transparent 65%)' }} />
        <div className="grid-bg absolute inset-0 opacity-50" />

        <div className="relative max-w-lg w-full">
          <div className="text-center mb-8">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
              Activation flow
            </p>
            <h1 className="font-display text-3xl font-bold mb-2">Welcome, {displayName}.</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Connect Claude Code so Tendon can start tracking real execution data.
            </p>
          </div>

          <div className="card p-5 mb-3">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
              1) Run once in terminal
            </p>
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-3 overflow-x-auto" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="text-sm shrink-0 mt-0.5" style={{ color: 'var(--subtle)' }}>$</span>
              <code className="text-xs flex-1 whitespace-nowrap select-all" style={{ color: 'var(--accent-light)' }}>{COMMAND}</code>
            </div>
            <button
              onClick={() => copy('cmd')}
              className="w-full py-2 rounded-lg text-xs font-medium border transition-all"
              style={{
                borderColor: copied === 'cmd' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.12)',
                color: copied === 'cmd' ? 'var(--accent)' : 'var(--muted)',
                background: copied === 'cmd' ? 'rgba(59,130,246,0.05)' : 'transparent',
              }}
            >
              {copied === 'cmd' ? '✓ Copied' : 'Copy command'}
            </button>
            <p className="text-xs mt-2" style={{ color: 'var(--subtle)' }}>
              Then restart Claude Code. MCP tools load only at startup.
            </p>
          </div>

          <div className="card p-5 mb-6">
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--muted)' }}>
              2) In Claude chat (not terminal), send:
            </p>
            <p className="text-xs font-mono mb-3" style={{ color: 'var(--accent-light)' }}>
              {FIRST_PROMPT}
            </p>
            <p className="text-xs" style={{ color: 'var(--subtle)' }}>
              Claude opens browser auth if needed. After that, Tendon checks connection automatically.
            </p>
          </div>

          <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Current status</p>
            <div className="space-y-1.5">
              {flowStatuses.map(({ key, label }) => {
                const idx = getStatusIndex(key);
                const done = idx < current;
                const active = idx === current;
                return (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <span style={{ color: done ? '#22C55E' : active ? 'var(--accent)' : 'var(--subtle)' }}>
                      {done ? '✓' : active ? '●' : '○'}
                    </span>
                    <span style={{ color: active || done ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={syncFlowState}
            disabled={checking}
            className="w-full py-3 rounded-lg text-sm border transition-all"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
          >
            {checking ? 'Checking…' : connected ? 'Connected — continue' : 'Check connection'}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'first_action') {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(59,130,246,0.07) 0%, transparent 65%)' }} />
        <div className="grid-bg absolute inset-0 opacity-50" />

        <div className="relative max-w-lg w-full">
          <div className="text-center mb-8">
            <p className="text-xs font-mono uppercase tracking-widest mb-4" style={{ color: 'var(--muted)' }}>
              Claude connected
            </p>
            <h1 className="font-display text-3xl font-bold mb-2">Run your first action</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              One prompt creates your first task, starts focus, and generates today&apos;s plan.
            </p>
          </div>

          <div className="card p-5 mb-5">
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>
              Send this in Claude:
            </p>
            <div className="rounded-lg px-3 py-3 mb-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
              <p className="text-xs font-mono leading-relaxed" style={{ color: 'var(--accent-light)' }}>
                {FIRST_PROMPT}
              </p>
            </div>
            <button
              onClick={() => {
                void copy('prompt');
                void trackEventOnce('first_prompt_sent', { from: 'onboarding_first_action' });
              }}
              className="w-full py-2 rounded-lg text-xs font-medium border transition-all"
              style={{
                borderColor: copied === 'prompt' ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.12)',
                color: copied === 'prompt' ? 'var(--accent)' : 'var(--muted)',
                background: copied === 'prompt' ? 'rgba(59,130,246,0.05)' : 'transparent',
              }}
            >
              {copied === 'prompt' ? '✓ Copied' : 'Copy first prompt'}
            </button>
          </div>

          <button onClick={syncFlowState} disabled={checking} className="amber-btn w-full py-3 rounded-lg text-sm">
            {checking ? 'Checking…' : 'I sent it — check first value'}
          </button>
          <p className="text-xs text-center mt-3" style={{ color: 'var(--subtle)' }}>
            Tendon also auto-checks every 10 seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 relative overflow-hidden" style={{ background: 'var(--bg)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 20%, rgba(34,197,94,0.07) 0%, transparent 65%)' }} />
      <div className="grid-bg absolute inset-0 opacity-50" />

      <div className="relative max-w-lg w-full">
        <div className="text-center mb-9">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M5 12l4.5 4.5L19 7" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">First value reached</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Tendon has started collecting execution data from your Claude workflow.
          </p>
        </div>

        <div className="card p-5 mb-5" style={{ borderColor: 'rgba(34,197,94,0.2)', background: 'rgba(34,197,94,0.02)' }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-4" style={{ color: 'var(--subtle)' }}>
            First run results
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="font-display text-2xl font-bold mb-0.5" style={{ color: snapshot.taskCount > 0 ? 'var(--accent)' : 'var(--subtle)' }}>
                {snapshot.taskCount}
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Active tasks
              </div>
            </div>
            <div className="rounded-lg px-4 py-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="font-display text-2xl font-bold mb-0.5" style={{ color: snapshot.trackedMinutes > 0 ? 'var(--text)' : 'var(--subtle)' }}>
                {snapshot.trackedMinutes}m
              </div>
              <div className="text-xs" style={{ color: 'var(--muted)' }}>
                Focus tracked today
              </div>
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Next step: continue work in Claude. Tendon will keep context and build your daily summary automatically.
          </p>
        </div>

        <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.1)' }}>
          <p className="text-xs font-medium mb-2" style={{ color: 'var(--muted)' }}>Resume prompt</p>
          <p className="text-xs font-mono" style={{ color: 'var(--accent-light)' }}>
            Continue where I stopped yesterday and suggest my next highest-impact step.
          </p>
        </div>

        <Link href="/dashboard" className="amber-btn w-full py-3 rounded-lg text-sm text-center block">
          Open dashboard →
        </Link>
      </div>
    </div>
  );
}
