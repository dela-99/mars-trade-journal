import { useMemo, useState, type ReactNode } from 'react';
import { Activity, BookOpen, Check, CircleAlert, Database, Download, Minus, Plus, RefreshCw, Search, Sparkles, Target, TrendingDown, TrendingUp, X } from 'lucide-react';
import { useDeleteTrade, useGetTradeSummary, useHealthCheck, useListTrades, getGetTradeSummaryQueryKey, getListTradesQueryKey } from '@workspace/api-client-react';
import type { Trade } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { TradeForm } from '@/components/trade-form';
import { TradeTable } from '@/components/trade-table';
import { ScreenshotPanel } from '@/components/screenshot-panel';
import { clearScreenshotsForTrade } from '@/hooks/use-local-screenshots';
import { PnlChart } from '@/components/pnl-chart';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'always' });
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, signDisplay: 'always' });
const csvHeaders = ['Symbol', 'Asset', 'Side', 'Lot size', 'Entry date', 'Strategy', 'Market regime', 'P&L', 'Notes'];

function csvCell(value: unknown) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function downloadJournalCsv(trades: Trade[]) {
  const rows = trades.map((trade) => [
    trade.symbol,
    trade.asset,
    trade.side,
    trade.lotSize,
    trade.entryAt,
    trade.strategy,
    trade.regime,
    trade.pnl,
    trade.notes ?? '',
  ]);
  const csv = [csvHeaders, ...rows]
    .map((row) => row.map((value) => `"${csvCell(value).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'mars-trade-journal.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function StatCard({ label, value, hint, tone = 'neutral', icon }: { label: string; value: string; hint: string; tone?: 'neutral' | 'positive' | 'negative'; icon: ReactNode }) {
  return <div className="stat-card animate-rise p-5" data-testid={`card-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="flex items-start justify-between"><span className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{label}</span><span className="text-muted-foreground">{icon}</span></div>
    <p className={`mt-5 font-display text-3xl font-bold tracking-tight ${tone === 'positive' ? 'text-primary' : tone === 'negative' ? 'text-destructive' : ''}`} data-testid={`text-stat-${label.toLowerCase().replaceAll(' ', '-')}`}>{value}</p>
    <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
  </div>;
}

export function Dashboard() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [side, setSide] = useState<'all' | 'buy' | 'sell'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [deletingTrade, setDeletingTrade] = useState<Trade | null>(null);
  const [screenshotTrade, setScreenshotTrade] = useState<Trade | null>(null);
  const [notice, setNotice] = useState('');
  const tradeQuery = useListTrades({ search: search || undefined, side: side === 'all' ? undefined : side });
  const allTradesQuery = useListTrades({});
  const summaryQuery = useGetTradeSummary();
  const healthQuery = useHealthCheck();
  const deleteTrade = useDeleteTrade();

  const trades = tradeQuery.data ?? [];
  const allTrades = allTradesQuery.data ?? [];
  const summary = summaryQuery.data;
  const hasFilters = Boolean(search) || side !== 'all';
  const visibleDescription = hasFilters ? `${trades.length} matching ${trades.length === 1 ? 'entry' : 'entries'}` : 'Your latest manual entries';
  const winRate = summary && summary.totalTrades > 0 ? Math.round((summary.winningTrades / summary.totalTrades) * 100) : 0;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListTradesQueryKey() });
    void queryClient.invalidateQueries({ queryKey: getGetTradeSummaryQueryKey() });
  };

  const openNew = () => { setEditingTrade(null); setFormOpen(true); setNotice(''); };
  const openEdit = (trade: Trade) => { setEditingTrade(trade); setFormOpen(true); setNotice(''); };
  const onSaved = (message: string) => {
    setNotice(message);
    setFormOpen(false);
    refresh();
  };
  const confirmDelete = () => {
    if (!deletingTrade) return;
    deleteTrade.mutate({ id: deletingTrade.id }, {
      onSuccess: () => { void clearScreenshotsForTrade(deletingTrade.id); setNotice(`${deletingTrade.symbol} was removed from your journal.`); setDeletingTrade(null); refresh(); },
      onError: () => setNotice('Could not remove this entry. Try again.'),
    });
  };

  const grouped = useMemo(() => {
    const recent = trades.slice(0, 3);
    return { recent };
  }, [trades]);

  return (
    <div className="mars-shell flex">
      <aside className="mars-sidebar fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col px-5 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Target size={19} strokeWidth={2.4} /></div>
          <div><p className="font-display text-[15px] font-extrabold tracking-[.18em]">M.A.R.S.</p><p className="font-mono-custom text-[9px] uppercase tracking-[.18em] text-sidebar-foreground/55">Trade journal</p></div>
        </div>
        <div className="mt-12">
          <p className="px-3 text-[10px] font-bold uppercase tracking-[.18em] text-sidebar-foreground/40">Workspace</p>
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-sidebar-accent px-3 py-2.5 text-sm font-medium text-sidebar-accent-foreground"><BookOpen size={16} className="text-sidebar-primary" />Journal overview</div>
        </div>
        <div className="mt-auto rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-4">
          <div className="flex items-center gap-2 text-xs font-medium"><span className={`h-1.5 w-1.5 rounded-full ${healthQuery.isError ? 'bg-destructive' : 'bg-sidebar-primary animate-pulse-soft'}`} />{healthQuery.isError ? 'Journal offline' : 'Journal connected'}</div>
          <p className="mt-2 text-xs leading-relaxed text-sidebar-foreground/55">The edge is in the review, not the rush.</p>
        </div>
      </aside>
      <main className="min-w-0 flex-1 lg:ml-[238px]">
        <header className="sticky top-0 z-10 border-b border-border/80 bg-background/90 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1420px] items-center justify-between px-5 py-4 md:px-8">
            <div className="flex items-center gap-3 lg:hidden"><div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Target size={16} /></div><span className="font-display text-sm font-extrabold tracking-[.16em]">M.A.R.S.</span></div>
            <div className="hidden lg:block"><p className="font-mono-custom text-[10px] uppercase tracking-[.18em] text-muted-foreground">Personal journal / 01</p></div>
            <div className="flex items-center gap-3"><span className="hidden text-xs text-muted-foreground md:block">Review mode</span><div className="h-2 w-2 rounded-full bg-primary" /><button type="button" className="btn-primary" onClick={openNew} data-testid="button-record-trade"><Plus size={16} />Record trade</button></div>
          </div>
        </header>
        <div className="paper-grid min-h-[calc(100dvh-73px)]">
          <div className="mx-auto max-w-[1420px] px-5 py-8 md:px-8 md:py-10">
            <div className="animate-rise flex flex-col justify-between gap-5 md:flex-row md:items-end">
              <div><p className="font-mono-custom text-[10px] font-medium uppercase tracking-[.22em] text-primary">Monday, review window</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-.045em] md:text-5xl">The record tells<br className="hidden md:block" /> the story.</h1><p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">A calm surface for the decisions behind your trades. Capture the setup, then come back with enough distance to learn.</p></div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Activity size={15} className="text-primary" /> One journal. No execution noise.</div>
            </div>
            <section className="mt-9 grid grid-cols-2 gap-3 lg:grid-cols-4 md:gap-4">
              <StatCard label="Net P&L" value={summary ? compactMoney.format(summary.totalPnl) : '—'} hint="Across all recorded trades" tone={summary && summary.totalPnl > 0 ? 'positive' : summary && summary.totalPnl < 0 ? 'negative' : 'neutral'} icon={<TrendingUp size={17} />} />
              <StatCard label="Win rate" value={summary ? `${winRate}%` : '—'} hint={summary ? `${summary.winningTrades} wins / ${summary.losingTrades} losses` : 'Loading journal data'} tone="positive" icon={<Sparkles size={17} />} />
              <StatCard label="Trade count" value={summary ? String(summary.totalTrades) : '—'} hint={summary ? `${summary.buys} buys · ${summary.sells} sells` : 'Loading journal data'} icon={<Database size={17} />} />
              <StatCard label="Markets" value={summary ? String(summary.symbolsTraded) : '—'} hint="Distinct symbols in journal" icon={<Target size={17} />} />
            </section>
             <section className="mt-8">
               <PnlChart trades={allTrades} />
             </section>
            <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
              <div className="stat-card overflow-hidden">
                <div className="flex flex-col gap-4 border-b border-border px-5 py-5 md:flex-row md:items-center md:justify-between">
                  <div><div className="flex items-center gap-2"><h2 className="font-display text-lg font-bold">Journal entries</h2><span className="rounded-full bg-muted px-2 py-0.5 font-mono-custom text-[10px] text-muted-foreground">{trades.length}</span></div><p className="mt-1 text-xs text-muted-foreground">{visibleDescription}</p></div>
                  <div className="flex flex-wrap items-center gap-2">
                     <button type="button" className="btn-quiet text-xs disabled:cursor-not-allowed disabled:opacity-50" onClick={() => downloadJournalCsv(allTrades)} disabled={allTradesQuery.isLoading} data-testid="button-export-journal-csv"><Download size={14} />Export CSV</button>
                    <label className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input className="control-input w-[180px] py-2 pl-8 text-xs" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a symbol" aria-label="Search trades" data-testid="input-search-trades" /></label>
                    <select className="control-input w-auto py-2 text-xs" value={side} onChange={(e) => setSide(e.target.value as 'all' | 'buy' | 'sell')} aria-label="Filter by side" data-testid="select-filter-side"><option value="all">All sides</option><option value="buy">Buys only</option><option value="sell">Sells only</option></select>
                    {hasFilters && <button type="button" className="btn-quiet text-xs" onClick={() => { setSearch(''); setSide('all'); }} data-testid="button-clear-filters"><X size={14} />Clear</button>}
                  </div>
                </div>
                {tradeQuery.isLoading ? <div className="space-y-3 p-5" data-testid="status-trades-loading">{[1, 2, 3].map((item) => <div key={item} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div> : tradeQuery.isError ? <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center" data-testid="status-trades-error"><CircleAlert size={24} className="text-destructive" /><p className="mt-3 text-sm font-semibold">Entries could not be loaded.</p><button type="button" className="btn-quiet mt-2 text-xs text-primary" onClick={() => void tradeQuery.refetch()} data-testid="button-retry-trades"><RefreshCw size={13} />Try again</button></div> : trades.length === 0 ? <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center" data-testid="status-trades-empty"><div className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"><BookOpen size={20} /></div><p className="mt-3 font-display font-bold">{hasFilters ? 'No entries match that filter.' : 'Your journal is ready.'}</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">{hasFilters ? 'Try another symbol or reset the side filter.' : 'Record your first manual trade and make the review surface yours.'}</p>{!hasFilters && <button type="button" className="btn-primary mt-4 text-xs" onClick={openNew} data-testid="button-record-first-trade"><Plus size={14} />Record first trade</button>}</div> : <TradeTable trades={trades} onEdit={openEdit} onDelete={setDeletingTrade} onScreenshots={setScreenshotTrade} />}
              </div>
              <aside className="space-y-6">
                <div className="stat-card p-5"><div className="flex items-center justify-between"><h2 className="font-display font-bold">Recent rhythm</h2><TrendingUp size={16} className="text-primary" /></div><p className="mt-1 text-xs text-muted-foreground">Last three entries at a glance</p><div className="mt-5 space-y-3">{grouped.recent.length === 0 ? <p className="py-3 text-xs text-muted-foreground">No rhythm yet. It starts with one considered entry.</p> : grouped.recent.map((trade) => <div key={trade.id} className="flex items-center justify-between border-b border-border/70 pb-3 last:border-0 last:pb-0"><div><p className="font-mono-custom text-xs font-medium">{trade.symbol}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{trade.strategy}</p></div><span className={`font-mono-custom text-xs font-medium ${trade.pnl > 0 ? 'text-primary' : trade.pnl < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{money.format(trade.pnl)}</span></div>)}</div></div>
                <div className="rounded-[14px] bg-sidebar p-5 text-sidebar-foreground shadow-sm"><div className="flex items-center gap-2"><div className="grid h-7 w-7 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground"><Target size={14} /></div><span className="font-mono-custom text-[10px] uppercase tracking-[.16em] text-sidebar-foreground/60">Review prompt</span></div><p className="mt-5 font-display text-lg font-bold leading-snug">Did the market behave as expected, or did you make it fit the plan?</p><div className="mt-5 flex items-center gap-2 text-xs text-sidebar-foreground/55"><Minus size={14} />Stay curious, stay specific.</div></div>
              </aside>
            </section>
          </div>
        </div>
      </main>
      <TradeForm open={formOpen} trade={editingTrade} onClose={() => setFormOpen(false)} onSuccess={onSaved} />
      <ScreenshotPanel trade={screenshotTrade} open={Boolean(screenshotTrade)} onClose={() => setScreenshotTrade(null)} />
      {notice && <div className="fixed bottom-5 right-5 z-30 flex max-w-sm items-start gap-3 rounded-xl border border-primary/20 bg-card px-4 py-3 text-sm shadow-lg animate-rise" role="status" data-testid="status-action-notice"><Check size={17} className="mt-0.5 shrink-0 text-primary" /><span>{notice}</span><button type="button" className="btn-quiet -mr-2 -mt-1 p-1" onClick={() => setNotice('')} aria-label="Dismiss message" data-testid="button-dismiss-notice"><X size={14} /></button></div>}
      {deletingTrade && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-title"><div className="modal-card max-w-sm p-6 animate-rise"><div className="flex items-start justify-between"><div><p className="font-mono-custom text-[10px] uppercase tracking-[.18em] text-destructive">Remove entry</p><h2 id="delete-title" className="mt-2 font-display text-xl font-bold">Delete {deletingTrade.symbol}?</h2></div><button type="button" className="btn-quiet -mr-2 -mt-2" onClick={() => setDeletingTrade(null)} aria-label="Close delete dialog" data-testid="button-close-delete"><X size={17} /></button></div><p className="mt-3 text-sm leading-relaxed text-muted-foreground">This journal entry will be permanently removed. There is no broker action involved.</p><div className="mt-6 flex justify-end gap-2"><button type="button" className="btn-quiet" onClick={() => setDeletingTrade(null)} data-testid="button-cancel-delete">Keep entry</button><button type="button" className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-sm font-bold text-destructive-foreground" onClick={confirmDelete} disabled={deleteTrade.isPending} data-testid="button-confirm-delete"><TrendingDown size={15} />{deleteTrade.isPending ? 'Removing…' : 'Delete entry'}</button></div></div></div>}
    </div>
  );
}