import type { ReactNode } from 'react';

interface SectionProps {
  eyebrow?: string;
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Section({ eyebrow, title, description, actions, children, className = '' }: SectionProps) {
  const hasHead = title || eyebrow || description || actions;
  return (
    <section className={`mb-10 ${className}`}>
      {hasHead && (
        <div className="flex items-end justify-between gap-4 mb-4">
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            {title && (
              <h2 className="heading text-base font-semibold" style={{ color: 'var(--text)' }}>
                {title}
              </h2>
            )}
            {description && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
