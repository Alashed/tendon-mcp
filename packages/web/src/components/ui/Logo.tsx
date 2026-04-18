import type { CSSProperties } from 'react';

interface LogoMarkProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/**
 * Tendon logo mark — monoline "t" with curl + hook.
 * Colorable via `currentColor`, so wrap in a color-setting container.
 */
export function LogoMark({
  size = 24,
  strokeWidth = 3.6,
  className,
  style,
  title = 'Tendon',
}: LogoMarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
      style={style}
    >
      <g
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M 22 18 C 20 15.5, 21.5 12, 25 12 C 28.5 12, 30 15.5, 28 18 L 28 45 C 28 51, 33 54, 38 52" />
        <path d="M 34 18 L 34 45 C 34 49, 36.5 51, 40 50" />
        <path d="M 18 22 L 44 22" />
      </g>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  /** Tile background. 'gradient' (default), 'solid', 'ghost' (transparent border), 'none' (no tile — plain mark) */
  variant?: 'gradient' | 'solid' | 'ghost' | 'none';
  /** Show wordmark "Tendon" next to the mark */
  withWordmark?: boolean;
  wordmarkSize?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Full brand lockup: tile + mark, optionally with wordmark.
 * Use this everywhere instead of ad-hoc "T"-in-a-gradient-square.
 */
export function Logo({
  size = 32,
  variant = 'gradient',
  withWordmark = false,
  wordmarkSize = 'md',
  className = '',
}: LogoProps) {
  const markSize = Math.round(size * 0.68);

  const tileStyle: CSSProperties =
    variant === 'gradient'
      ? {
          width: size,
          height: size,
          borderRadius: size >= 40 ? 14 : size >= 28 ? 10 : 8,
          background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
          color: '#fff',
          boxShadow: '0 4px 14px -4px rgba(99,102,241,0.45), inset 0 1px 0 rgba(255,255,255,0.14)',
        }
      : variant === 'solid'
        ? {
            width: size,
            height: size,
            borderRadius: size >= 40 ? 14 : size >= 28 ? 10 : 8,
            background: 'var(--text)',
            color: 'var(--bg)',
          }
        : variant === 'ghost'
          ? {
              width: size,
              height: size,
              borderRadius: size >= 40 ? 14 : size >= 28 ? 10 : 8,
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
            }
          : {
              width: size,
              height: size,
              color: 'currentColor',
            };

  const wordSizeClass =
    wordmarkSize === 'lg' ? 'text-lg' : wordmarkSize === 'sm' ? 'text-xs' : 'text-sm';

  const mark =
    variant === 'none' ? (
      <LogoMark size={size} strokeWidth={3.6} />
    ) : (
      <div className="flex items-center justify-center" style={tileStyle}>
        <LogoMark size={markSize} strokeWidth={4} />
      </div>
    );

  if (!withWordmark) {
    return <span className={`inline-flex items-center ${className}`}>{mark}</span>;
  }

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {mark}
      <span
        className={`font-display font-semibold tracking-tight ${wordSizeClass}`}
        style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}
      >
        Tendon
      </span>
    </span>
  );
}
