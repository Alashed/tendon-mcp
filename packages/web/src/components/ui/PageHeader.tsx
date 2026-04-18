import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions, children }: PageHeaderProps) {
  return (
    <header
      className="sticky top-0 z-10 px-8 pt-6 pb-5 border-b backdrop-blur-md"
      style={{
        borderColor: 'var(--border)',
        background: 'rgba(8, 8, 11, 0.72)',
      }}
    >
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="heading text-2xl leading-tight" style={{ letterSpacing: '-0.02em' }}>
            {title}
          </h1>
          {description && (
            <p className="text-sm mt-1.5" style={{ color: 'var(--muted)' }}>
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
