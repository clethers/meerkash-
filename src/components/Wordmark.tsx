export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline rounded-[14px] bg-[#10241c] px-[18px] py-[10px] text-[22px] ${className}`}
    >
      <span className="font-display font-black leading-none tracking-[-0.01em] text-[#eef6f1]">
        meerkash<span className="text-[#e3bd72]">.</span>
      </span>
    </span>
  );
}
