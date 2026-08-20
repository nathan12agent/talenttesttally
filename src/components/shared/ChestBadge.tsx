'use client';

interface ChestBadgeProps {
  chestNo: string;
  size?: 'sm' | 'md' | 'lg';
  isPodium?: boolean;
  rank?: 1 | 2 | 3;
  pulse?: boolean;
}

const sizeClasses = {
  sm: 'text-lg px-2 py-0.5 rounded-md min-w-[2.5rem]',
  md: 'text-2xl px-3 py-1 rounded-lg min-w-[3.5rem]',
  lg: 'text-4xl px-4 py-2 rounded-xl min-w-[5rem]',
};

const dotSizeClasses = {
  sm: 'w-1.5 h-1.5 -top-0.5 -right-0.5',
  md: 'w-2 h-2 -top-1 -right-1',
  lg: 'w-2.5 h-2.5 -top-1 -right-1',
};

const rankBorderColor: Record<1 | 2 | 3, string> = {
  1: 'border-podium-gold',
  2: 'border-podium-silver',
  3: 'border-podium-bronze',
};

const rankDotColor: Record<1 | 2 | 3, string> = {
  1: 'bg-podium-gold',
  2: 'bg-podium-silver',
  3: 'bg-podium-bronze',
};

const rankGlow: Record<1 | 2 | 3, string> = {
  1: 'shadow-[0_0_12px_3px_rgba(212,175,55,0.5)]',
  2: 'shadow-[0_0_12px_3px_rgba(184,188,194,0.4)]',
  3: 'shadow-[0_0_12px_3px_rgba(176,141,87,0.4)]',
};

export function ChestBadge({
  chestNo,
  size = 'md',
  isPodium = false,
  rank,
  pulse = false,
}: ChestBadgeProps) {
  const borderColor =
    rank && isPodium ? rankBorderColor[rank] : 'border-spotlight-gold';
  const dotColor = rank && isPodium ? rankDotColor[rank] : 'bg-spotlight-gold';
  const glow = rank && isPodium ? rankGlow[rank] : '';
  const pulseClass = pulse ? 'animate-gold-pulse' : '';

  return (
    <div
      className={[
        'relative inline-flex items-center justify-center',
        'bg-stage-charcoal border-2',
        'font-display text-ink',
        'select-none',
        borderColor,
        sizeClasses[size],
        isPodium ? glow : '',
        pulseClass,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Chest number ${chestNo}`}
    >
      {chestNo}
      {/* Pin-motif dot in top-right corner */}
      <span
        className={[
          'absolute rounded-full',
          dotSizeClasses[size],
          dotColor,
        ].join(' ')}
        aria-hidden="true"
      />
    </div>
  );
}
