import { ArrowDownLeft, ArrowUpRight, Edit3, FileImage, FileText, Trash2 } from 'lucide-react';
import type { Trade } from '@/api-client';

type TradeTableProps = {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  onNote: (trade: Trade) => void;
  onScreenshots: (trade: Trade) => void;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'always' });
const entryDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
const entryTime = (value: string) => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
const pnlTone = (pnl: number) => pnl > 0 ? 'text-primary' : pnl < 0 ? 'text-destructive' : 'text-muted-foreground';

function Direction({ side }: { side: Trade['side'] }) {
  return <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${side === 'buy' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'}`}>
    {side === 'buy' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
  </span>;
}

export function TradeTable({ trades, onEdit, onDelete, onScreenshots, onNote }: TradeTableProps) {
  const actions = (trade: Trade, mobile = false) => <div className={`flex items-center gap-1 ${mobile ? 'flex-wrap border-t border-border/70 pt-3' : 'justify-end'}`}>
    {mobile && <button type="button" className="btn-quiet min-h-10 text-xs" onClick={() => onEdit(trade)} aria-label={`Edit ${trade.symbol}`}><Edit3 size={15} />Edit</button>}
    <button type="button" className="btn-quiet min-h-10 min-w-10 text-xs" onClick={() => onNote(trade)} aria-label={`Write note for trade ${trade.id} ${trade.symbol}`} title="Write a linked note"><FileText size={15} />{mobile && 'Note'}</button>
    <button type="button" className="btn-quiet min-h-10 min-w-10 text-xs" onClick={() => onScreenshots(trade)} aria-label={`Manage screenshots for ${trade.symbol}`} title="View browser screenshots" data-testid={`${mobile ? 'mobile-' : ''}button-screenshots-trade-${trade.id}`}><FileImage size={15} />{mobile && 'Images'}</button>
    <button type="button" className={`btn-quiet min-h-10 min-w-10 hover:text-destructive ${mobile ? 'ml-auto' : ''}`} onClick={() => onDelete(trade)} aria-label={`Delete ${trade.symbol}`} title="Delete trade" data-testid={`${mobile ? 'mobile-' : ''}button-delete-trade-${trade.id}`}><Trash2 size={15} /></button>
  </div>;

  return <>
    <div className="divide-y divide-border md:hidden" aria-label="Trade cards">
      {trades.map(trade => <article key={trade.id} className="space-y-3 p-4" data-testid={`card-trade-${trade.id}`}>
        <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><Direction side={trade.side} /><div className="min-w-0"><h3 className="break-words font-mono-custom text-sm font-medium">{trade.symbol}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{trade.asset} · <span className="capitalize">{trade.side}</span></p></div></div><p className={`shrink-0 font-mono-custom text-sm font-medium ${pnlTone(trade.pnl)}`}>{currency.format(trade.pnl)}</p></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs"><div><dt className="text-muted-foreground">Entry</dt><dd className="mt-1">{entryDate(trade.entryAt)}<span className="block text-muted-foreground">{entryTime(trade.entryAt)}</span></dd></div><div><dt className="text-muted-foreground">Lot size</dt><dd className="mt-1 font-mono-custom">{trade.lotSize.toFixed(2)}</dd></div><div className="min-w-0"><dt className="text-muted-foreground">Strategy</dt><dd className="mt-1 break-words">{trade.strategy}</dd></div><div className="min-w-0"><dt className="text-muted-foreground">Market regime</dt><dd className="mt-1 break-words">{trade.regime}</dd></div></dl>
        {trade.notes && <div className="rounded-lg bg-muted/40 px-3 py-2"><p className="line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">{trade.notes}</p></div>}
        {actions(trade, true)}
      </article>)}
    </div>
    <div className="table-wrap hidden md:block" role="region" aria-label="Trades table, scroll horizontally for all columns" tabIndex={0}>
      <table className="w-full min-w-[920px] table-fixed border-collapse text-left">
        <caption className="sr-only">Journal trades with entry dates, strategies, position sizes, profit and loss, and actions.</caption>
        <colgroup><col className="w-[22%]" /><col className="w-[18%]" /><col className="w-[22%]" /><col className="w-[9%]" /><col className="w-[13%]" /><col className="w-[16%]" /></colgroup>
        <thead><tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-[.12em] text-muted-foreground">
          <th scope="col" className="px-5 py-3 font-semibold">Trade</th><th scope="col" className="px-3 py-3 font-semibold">Entry</th><th scope="col" className="px-3 py-3 font-semibold">Playbook</th><th scope="col" className="px-3 py-3 text-right font-semibold">Lots</th><th scope="col" className="px-3 py-3 text-right font-semibold">P&L</th><th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
        </tr></thead>
        <tbody>{trades.map(trade => <tr key={trade.id} className="table-row border-b border-border/70 last:border-0" data-testid={`row-trade-${trade.id}`}>
          <td className="px-5 py-4"><div className="flex items-center gap-3"><Direction side={trade.side} /><div className="min-w-0"><p className="break-words font-mono-custom text-sm font-medium" data-testid={`text-trade-symbol-${trade.id}`}>{trade.symbol}</p><p className="mt-0.5 break-words text-xs text-muted-foreground">{trade.asset} · <span className="capitalize">{trade.side}</span></p><button type="button" className="mt-1 inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-md text-xs font-semibold text-primary hover:underline" onClick={() => onEdit(trade)} aria-label={`Edit ${trade.symbol}`} aria-haspopup="dialog" data-testid={`button-edit-trade-${trade.id}`}><Edit3 size={12} />Edit entry</button></div></div></td>
          <td className="px-3 py-4"><p className="text-sm">{entryDate(trade.entryAt)}</p><p className="mt-1 text-xs text-muted-foreground">{entryTime(trade.entryAt)}</p></td>
          <td className="px-3 py-4"><p className="break-words text-sm">{trade.strategy}</p><p className="mt-1 break-words text-xs text-muted-foreground">{trade.regime}</p>{trade.notes && <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground" title={trade.notes}><FileText size={12} /><span className="truncate">{trade.notes}</span></p>}</td>
          <td className="px-3 py-4 text-right font-mono-custom text-sm tabular-nums" data-testid={`text-trade-lot-size-${trade.id}`}>{trade.lotSize.toFixed(2)}</td>
          <td className={`px-3 py-4 text-right font-mono-custom text-sm font-medium tabular-nums ${pnlTone(trade.pnl)}`} data-testid={`text-trade-pnl-${trade.id}`}>{currency.format(trade.pnl)}</td>
          <td className="px-4 py-4">{actions(trade)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
