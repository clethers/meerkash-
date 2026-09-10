import { avatarColor, cn, initials } from '@/lib/utils';

export function Avatar({
  name,
  src,
  seed,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  seed?: string;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={name}
        style={dimension}
        className={cn('shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <span
      style={{ ...dimension, backgroundColor: avatarColor(seed ?? name), fontSize: size * 0.38 }}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white',
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
