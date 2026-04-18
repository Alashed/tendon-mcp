import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl"
      style={{
        background: 'var(--surface)',
        border: '1px dashed var(--border-hover)',
      }}
    >
      {icon && (
        <div
          className="w-10 h-10 flex items-center justify-center rounded-full mb-4"
          style={{
            background: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.22)',
            color: 'var(--accent-light)',
          }}
        >
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </p>
      {description && (
        <p className="text-sm mt-1.5 max-w-sm" style={{ color: 'var(--muted)' }}>
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
