import { CATEGORY_EMOJI, CATEGORY_LABEL } from '@/lib/constants';
import { formatMoney } from '@/lib/money';
import type { CategorySpend, MonthSpend } from '@/lib/data/spending';

export function CategoryBarChart({
  data,
  currency,
}: {
  data: CategorySpend[];
  currency: string;
}) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.category} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-sm text-slate-700 dark:text-slate-300">
            {CATEGORY_EMOJI[d.category]} {CATEGORY_LABEL[d.category]}
          </div>
          <svg
            viewBox="0 0 100 10"
            preserveAspectRatio="none"
            className="h-3 flex-1 overflow-visible"
            role="img"
            aria-label={`${CATEGORY_LABEL[d.category]}: ${formatMoney(d.total, currency)}`}
          >
            <rect x="0" y="0" width="100" height="10" rx="5" className="fill-slate-100 dark:fill-white/10" />
            <rect x="0" y="0" width={(d.total / max) * 100} height="10" rx="5" className="fill-brand-500 dark:fill-brand-400" />
          </svg>
          <div className="w-24 shrink-0 text-right text-sm font-medium text-slate-900 dark:text-slate-50">
            {formatMoney(d.total, currency)}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MonthBarChart({ data, currency }: { data: MonthSpend[]; currency: string }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  const columnWidth = 100 / data.length;
  const barWidth = columnWidth * 0.5;

  return (
    <div>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="h-32 w-full overflow-visible">
        {data.map((d, i) => {
          const height = (d.total / max) * 52;
          const x = i * columnWidth + (columnWidth - barWidth) / 2;
          return (
            <rect
              key={d.key}
              x={x}
              y={54 - height}
              width={barWidth}
              height={height}
              rx="2"
              className={d.total > 0 ? 'fill-brand-500 dark:fill-brand-400' : 'fill-slate-100 dark:fill-white/10'}
            >
              <title>{`${d.label}: ${formatMoney(d.total, currency)}`}</title>
            </rect>
          );
        })}
        <line x1="0" y1="54" x2="100" y2="54" className="stroke-slate-200 dark:stroke-white/10" strokeWidth="0.5" />
      </svg>
      <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <div key={d.key} className="text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{d.label}</p>
            <p className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">{formatMoney(d.total, currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
