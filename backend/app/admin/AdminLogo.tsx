/**
 * Точно същото лого, което се ползва в navbar-а на публичния сайт
 * (виж frontend/components/ui/Logo.tsx). Поддържа три размера: sm / md / lg.
 *
 * Запазено като чист SVG (server-component compatible) — без useState/useRouter.
 */

type LogoSize = "sm" | "md" | "lg";

const SIZES: Record<LogoSize, { text: string; icon: string; margin: string }> = {
  sm: { text: "text-lg sm:text-xl", icon: "h-7 sm:h-8", margin: "mr-1" },
  md: { text: "text-xl sm:text-2xl", icon: "h-8 sm:h-9", margin: "mr-1.5" },
  lg: { text: "text-2xl sm:text-3xl", icon: "h-10 sm:h-12", margin: "mr-2" },
};

export function AdminLogo({
  size = "md",
  className = "",
  uniqueId = "admin",
  showIcon = true,
}: {
  size?: LogoSize;
  className?: string;
  /** Уникален суфикс за SVG <defs> id-та (при повече от едно лого на страницата). */
  uniqueId?: string;
  /** Показва SVG знака (C) отляво на текста. */
  showIcon?: boolean;
}) {
  const current = SIZES[size];
  const orangeId = `brandOrange-${uniqueId}`;
  const blueId = `brandBlue-${uniqueId}`;
  const shadowId = `logoShadow-${uniqueId}`;

  return (
    <div className={`flex items-center select-none ${className}`}>
      <div className={`flex items-center tracking-[-0.05em] font-sans font-black leading-none uppercase ${current.text}`}>
        {showIcon && (
        <svg
          viewBox="0 5 73 90"
          className={`${current.icon} ${current.margin} w-auto shrink-0`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id={orangeId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF4D00" />
              <stop offset="50%" stopColor="#FF6A00" />
              <stop offset="100%" stopColor="#FF2A4D" />
            </linearGradient>
            <linearGradient id={blueId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00B4D8" />
              <stop offset="100%" stopColor="#0077B6" />
            </linearGradient>
            <filter id={shadowId} x="-10%" y="-10%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Знак градус (горе-ляво) */}
          <circle cx="12" cy="12" r="5" stroke={`url(#${orangeId})`} strokeWidth="3" fill="none" filter={`url(#${shadowId})`} />

          {/* Горна дъга — оранжева */}
          <path
            d="M 70 15.4 A 40 40 0 0 0 10.1 47 L 28.2 47 A 22 22 0 0 1 61 30.9 Z"
            fill={`url(#${orangeId})`}
            filter={`url(#${shadowId})`}
          />

          {/* Долна дъга — синя */}
          <path
            d="M 10.1 53 A 40 40 0 0 0 70 84.6 L 61 69.1 A 22 22 0 0 1 28.2 53 Z"
            fill={`url(#${blueId})`}
            filter={`url(#${shadowId})`}
          />

          {/* Централна точка — горна половина оранжева */}
          <path
            d="M 62.6 47 A 13 13 0 0 0 37.4 47 Z"
            fill={`url(#${orangeId})`}
            filter={`url(#${shadowId})`}
          />

          {/* Централна точка — долна половина синя */}
          <path
            d="M 37.4 53 A 13 13 0 0 0 62.6 53 Z"
            fill={`url(#${blueId})`}
            filter={`url(#${shadowId})`}
          />
        </svg>
        )}

        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D]">
          СМОЛЯН
        </span>
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6]">
          КЛИМА
        </span>
      </div>
    </div>
  );
}
