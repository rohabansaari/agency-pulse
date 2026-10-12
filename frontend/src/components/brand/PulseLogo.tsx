import { cn } from "@/lib/cn";

type Tone = "light" | "dark";

const STROKES: Record<Tone, { letter: string; pulse: string }> = {
  // On light grounds: ink letter, blue pulse.
  light: { letter: "#111723", pulse: "#2F5BEA" },
  // On dark grounds: white letter, lightened pulse.
  dark: { letter: "#FFFFFF", pulse: "#7C9BFF" },
};

/** The "Pulse A" mark: the A of Agency with a heartbeat for its crossbar. */
export function PulseMark({
  tone = "light",
  className,
  title,
}: {
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  const { letter, pulse } = STROKES[tone];

  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("h-8 w-8 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M12 54 32 10l20 44"
        fill="none"
        stroke={letter}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 39h9l4-7 5 12 4-8 3 3h11"
        fill="none"
        stroke={pulse}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mark + "AgencyPulse" wordmark, with "Pulse" in the accent color. */
export function PulseLogo({
  tone = "light",
  className,
  markClassName,
}: {
  tone?: Tone;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <PulseMark tone={tone} className={markClassName} />
      <span style={{ color: STROKES[tone].letter }}>
        Agency<span style={{ color: STROKES[tone].pulse }}>Pulse</span>
      </span>
    </span>
  );
}
