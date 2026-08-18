import Image from "next/image";
import Link from "next/link";

type UniFlowLogoProps = {
  href?: string;
  compact?: boolean;
  darkSurface?: boolean;
  className?: string;
};

export default function UniFlowLogo({
  href,
  compact = false,
  darkSurface = false,
  className = "",
}: UniFlowLogoProps) {
  const logo = (
    <div
      className={[
        "inline-flex items-center justify-center overflow-hidden",
        "bg-white",
        darkSurface
          ? "rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.20)]"
          : "rounded-2xl border border-slate-200 shadow-sm",
        compact
          ? "h-[68px] w-[190px] px-3 py-2"
          : "h-[104px] w-[290px] px-4 py-3",
        className,
      ].join(" ")}
    >
      <div className="relative h-full w-full">
        <Image
          src="/brand/uniflow-logo.png"
          alt="UniFlow Academic Planner"
          fill
          priority
          sizes={compact ? "190px" : "290px"}
          className="object-contain"
        />
      </div>
    </div>
  );

  if (!href) {
    return logo;
  }

  return (
    <Link
      href={href}
      aria-label="UniFlow Academic Planner"
      className="inline-flex"
    >
      {logo}
    </Link>
  );
}
