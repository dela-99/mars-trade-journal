import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Trade } from "@/api-client";

type PnlChartProps = {
  trades: Trade[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  signDisplay: "always",
  maximumFractionDigits: 2,
});

const axisCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  signDisplay: "always",
});

export function PnlChart({ trades }: PnlChartProps) {
  const points = [...trades]
    .sort((a, b) => new Date(a.entryAt).getTime() - new Date(b.entryAt).getTime())
    .reduce<Array<{ date: string; symbol: string; cumulativePnl: number }>>((result, trade) => {
      const previous = result.at(-1)?.cumulativePnl ?? 0;
      result.push({
        date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(trade.entryAt)),
        symbol: trade.symbol,
        cumulativePnl: previous + trade.pnl,
      });
      return result;
    }, []);

  return (
    <section className="stat-card p-5" aria-labelledby="pnl-chart-title">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="pnl-chart-title" className="font-display text-lg font-bold">P&L curve</h2>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono-custom text-[10px] text-primary">CUMULATIVE</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Net journal P&L in entry order, not an execution or account balance.</p>
        </div>
        {points.length > 0 && <p className={`font-mono-custom text-sm font-medium ${points.at(-1)!.cumulativePnl > 0 ? "text-primary" : points.at(-1)!.cumulativePnl < 0 ? "text-destructive" : "text-muted-foreground"}`}>{currency.format(points.at(-1)!.cumulativePnl)}</p>}
      </div>

      {points.length === 0 ? (
        <div className="mt-5 flex h-[220px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-5 text-center">
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">Your P&L curve will appear after the first journal entry is recorded.</p>
        </div>
      ) : (
        <div className="relative mt-5 h-[220px] w-full overflow-hidden" data-testid="chart-pnl-curve">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pnlFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#44986D" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#44986D" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={(value: number) => axisCurrency.format(value)} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={58} />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
              <Tooltip
                cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1 }}
                contentStyle={{ borderRadius: 10, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                labelFormatter={(label, payload) => `${label} · ${payload[0]?.payload?.symbol ?? ""}`}
                formatter={(value) => [currency.format(Number(value)), "Cumulative P&L"]}
              />
              <Area type="monotone" dataKey="cumulativePnl" name="Cumulative P&L" stroke="#44986D" strokeWidth={2.5} fill="url(#pnlFill)" dot={points.length < 10} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}