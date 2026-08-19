type UniFlowBuildCreditProps = {
  dark?: boolean;
  className?: string;
};

export default function UniFlowBuildCredit({
  dark = false,
  className = "",
}: UniFlowBuildCreditProps) {
  return (
    <div
      className={`text-center text-[11px] leading-[1.55] ${
        dark
          ? "text-cyan-50/60"
          : "text-slate-400"
      } ${className}`}
    >
      <div>
        Designed &amp; Developed by
      </div>

      <div
        className={`mt-1 text-xs font-bold ${
          dark
            ? "text-white/90"
            : "text-[#071b3c]"
        }`}
      >
        Mazid Ishtique Ahmed
      </div>

      <div
        className={`mt-0.5 ${
          dark
            ? "text-cyan-50/70"
            : "text-slate-500"
        }`}
      >
        Assistant Professor, EEE, and Chairman, Robotics &amp; Automation Engg.,
      </div>

      <div
        className={
          dark
            ? "text-cyan-50/70"
            : "text-slate-500"
        }
      >
        Atish Dipankar University of Science &amp; Technology (ADUST), Bangladesh
      </div>

      <div
        className={`mt-2 text-[10px] font-bold uppercase tracking-[0.18em] ${
          dark
            ? "text-cyan-300/80"
            : "text-[#0867b2]"
        }`}
      >
        UniFlow Academic Planner
      </div>
    </div>
  );
}
