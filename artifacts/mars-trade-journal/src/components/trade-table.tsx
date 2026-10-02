import { ArrowDownLeft, ArrowUpRight, Edit3, FileImage, FileText, Trash2 } from 'lucide-react';
import type { Trade } from '@workspace/api-client-react';

type TradeTableProps = {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (trade: Trade) => void;
  onScreenshots: (trade: Trade) => void;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', signDisplay: 'always' });
const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));

export function TradeTable({ trades, onEdit, onDelete, onScreenshots }: TradeTableProps) {
  return (
    <div className="table-wrap">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-[10px] uppercase tracking-[.14em] text-muted-foreground">
            <th className="px-5 py-3 font-bold">Trade</th>
            <th className="px-3 py-3 font-bold">Entry</th>
            <th className="px-3 py-3 font-bold">Playbook</th>
            <th className="px-3 py-3 text-right font-bold">Size</th>
            <th className="px-3 py-3 text-right font-bold">P&L</th>
            <th className="w-24 px-5 py-3 text-right font-bold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="table-row border-b border-border/70 last:border-0" data-testid={`row-trade-${trade.id}`}>
              <td className="px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-lg ${trade.side === 'buy' ? 'bg-primary/10 text-primary' : 'bg-accent/15 text-accent-foreground'}`}>
                    {trade.side === 'buy' ? <ArrowUpRight size={17} /> : <ArrowDownLeft size={17} />}
                  </span>
                  <div>
                    <p className="font-mono-custom text-sm font-medium tracking-wide" data-testid={`text-trade-symbol-${trade.id}`}>{trade.symbol}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{trade.asset} · <span className="capitalize">{trade.side}</span></p>
                    <button type="button" className="mt-1 inline-flex min-h-8 items-center gap-1 rounded-md text-xs font-semibold text-primary hover:underline" onClick={() => onEdit(trade)} aria-label={`Edit ${trade.symbol}`} aria-haspopup="dialog" title={`Edit ${trade.symbol}`} data-testid={`button-edit-trade-${trade.id}`}><Edit3 size={13} /><span>Edit entry</span></button>
                  </div>
                </div>
              </td>
              <td className="px-3 py-4"><p className="text-sm">{formatDate(trade.entryAt)}</p><p className="mt-0.5 text-xs text-muted-foreground">{trade.regime}</p></td>
              <td className="px-3 py-4"><p className="text-sm">{trade.strategy}</p>{trade.notes && <p className="mt-0.5 flex max-w-[220px] items-center gap-1 truncate text-xs text-muted-foreground"><FileText size={12} />{trade.notes}</p>}</td>
              <td className="px-3 py-4 text-right font-mono-custom text-sm" data-testid={`text-trade-lot-size-${trade.id}`}>{trade.lotSize.toFixed(2)}</td>
              <td className={`px-3 py-4 text-right font-mono-custom text-sm font-medium ${trade.pnl > 0 ? 'text-primary' : trade.pnl < 0 ? 'text-destructive' : 'text-muted-foreground'}`} data-testid={`text-trade-pnl-${trade.id}`}>{currency.format(trade.pnl)}</td>
              <td className="px-5 py-4">
                <div className="flex justify-end gap-1">
                  <button type="button" className="btn-quiet" onClick={() => onScreenshots(trade)} aria-label={`Manage screenshots for ${trade.symbol}`} data-testid={`button-screenshots-trade-${trade.id}`}><FileImage size={15} /></button>
                  <button type="button" className="btn-quiet hover:text-destructive" onClick={() => onDelete(trade)} aria-label={`Delete ${trade.symbol}`} data-testid={`button-delete-trade-${trade.id}`}><Trash2 size={15} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}