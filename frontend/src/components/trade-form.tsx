import { useEffect, useState, type FormEvent } from 'react';
import { Check, CircleX, Save, X } from 'lucide-react';
import { useCreateTrade, useUpdateTrade } from '@/api-client';
import type { Trade } from '@/api-client';

const SYMBOL_OPTIONS = ['XAUUSD', 'EURUSD', 'USDJPY'] as const;

type TradeFormState = {
  symbol: string;
  asset: string;
  side: 'buy' | 'sell';
  lotSize: string;
  entryAt: string;
  strategy: string;
  regime: string;
  pnl: string;
  notes: string;
};

type TradeFormProps = {
  open: boolean;
  trade?: Trade | null;
  onClose: () => void;
  onSuccess: (message: string) => void;
};

const formatDateInput = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const initialState: TradeFormState = {
  symbol: 'XAUUSD',
  asset: '',
  side: 'buy',
  lotSize: '',
  entryAt: formatDateInput(new Date().toISOString()),
  strategy: '',
  regime: '',
  pnl: '',
  notes: '',
};

export function TradeForm({ open, trade, onClose, onSuccess }: TradeFormProps) {
  const [form, setForm] = useState<TradeFormState>(initialState);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const createTrade = useCreateTrade();
  const updateTrade = useUpdateTrade();
  const isEditing = Boolean(trade);
  const isPending = createTrade.isPending || updateTrade.isPending;

  useEffect(() => {
    if (!open) return;
    setError('');
    setSaved(false);
    setForm(trade ? {
      symbol: trade.symbol,
      asset: trade.asset,
      side: trade.side,
      lotSize: String(trade.lotSize),
      entryAt: formatDateInput(trade.entryAt),
      strategy: trade.strategy,
      regime: trade.regime,
      pnl: String(trade.pnl),
      notes: trade.notes ?? '',
    } : initialState);
  }, [open, trade]);

  if (!open) return null;

  const setField = (field: keyof TradeFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const required: Array<[keyof TradeFormState, string]> = [
      ['symbol', 'Symbol'], ['asset', 'Asset'], ['strategy', 'Strategy'], ['regime', 'Regime'],
    ];
    const missing = required.find(([key]) => !form[key].trim());
    if (missing) {
      setError(`${missing[1]} is required.`);
      return;
    }
    const lotSize = Number(form.lotSize);
    const pnl = Number(form.pnl);
    if (!Number.isFinite(lotSize) || lotSize <= 0) {
      setError('Lot size must be greater than zero.');
      return;
    }
    if (!Number.isFinite(pnl)) {
      setError('P&L must be a valid number.');
      return;
    }
    if (!form.entryAt) {
      setError('Entry date and time is required.');
      return;
    }
    const payload = {
      symbol: form.symbol.trim().toUpperCase(),
      asset: form.asset.trim(),
      side: form.side,
      lotSize,
      entryAt: new Date(form.entryAt).toISOString(),
      strategy: form.strategy.trim(),
      regime: form.regime.trim(),
      pnl,
      notes: form.notes.trim() || null,
    };
    const options = {
      onSuccess: () => {
        setSaved(true);
        onSuccess(isEditing ? 'Trade updated. Review your notes while it is fresh.' : 'Trade recorded. Nice and deliberate.');
      },
      onError: () => setError('The journal could not save this entry. Try again.'),
    };
    if (trade) {
      updateTrade.mutate({ id: trade.id, data: payload }, options);
    } else {
      createTrade.mutate({ data: payload }, options);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trade-form-title">
      <div className="modal-card animate-rise">
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="font-mono-custom text-[10px] font-medium uppercase tracking-[.2em] text-primary">Journal entry / {isEditing ? 'edit' : 'new'}</p>
            <h2 id="trade-form-title" className="mt-1 font-display text-2xl font-bold tracking-tight">{isEditing ? 'Edit trade entry' : 'Record a trade'}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{isEditing ? 'Correct any field, then save your updated journal entry.' : 'A manual note for your review process, never an order.'}</p>
          </div>
          <button type="button" className="btn-quiet" onClick={onClose} aria-label="Close trade form" data-testid="button-close-trade-form"><X size={18} /></button>
        </div>
        <form onSubmit={submit} className="space-y-5 px-6 py-6">
          {error && <div className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/5 px-3 py-2.5 text-sm text-destructive" role="alert" data-testid="status-trade-form-error"><CircleX size={16} className="mt-0.5 shrink-0" />{error}</div>}
          {saved && <div className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 text-sm text-primary" data-testid="status-trade-form-success"><Check size={16} className="mt-0.5 shrink-0" />Saved successfully. Close this panel to return to your review.</div>}
          <div className="grid grid-cols-2 gap-4 mobile-stack">
             <label><span className="control-label">Symbol</span><select className="control-input font-mono-custom" value={form.symbol} onChange={(e) => setField('symbol', e.target.value)} data-testid="select-trade-symbol">{!SYMBOL_OPTIONS.includes(form.symbol as typeof SYMBOL_OPTIONS[number]) && form.symbol && <option value={form.symbol}>{form.symbol}</option>}{SYMBOL_OPTIONS.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}</select></label>
            <label><span className="control-label">Asset class</span><input className="control-input" value={form.asset} onChange={(e) => setField('asset', e.target.value)} placeholder="Forex" data-testid="input-trade-asset" /></label>
          </div>
          <div className="grid grid-cols-3 gap-4 mobile-stack">
            <label><span className="control-label">Direction</span><select className="control-input" value={form.side} onChange={(e) => setField('side', e.target.value)} data-testid="select-trade-side"><option value="buy">Buy</option><option value="sell">Sell</option></select></label>
            <label><span className="control-label">Lot size</span><input type="number" min="0.0001" step="0.0001" className="control-input font-mono-custom" value={form.lotSize} onChange={(e) => setField('lotSize', e.target.value)} placeholder="0.50" data-testid="input-trade-lot-size" /></label>
            <label><span className="control-label">P&L</span><input type="number" step="0.01" className="control-input font-mono-custom" value={form.pnl} onChange={(e) => setField('pnl', e.target.value)} placeholder="240.00" data-testid="input-trade-pnl" /></label>
          </div>
          <label><span className="control-label">Entry date & time</span><input type="datetime-local" className="control-input" value={form.entryAt} onChange={(e) => setField('entryAt', e.target.value)} data-testid="input-trade-entry-at" /></label>
          <div className="grid grid-cols-2 gap-4 mobile-stack">
            <label><span className="control-label">Strategy</span><input className="control-input" value={form.strategy} onChange={(e) => setField('strategy', e.target.value)} placeholder="Breakout retest" data-testid="input-trade-strategy" /></label>
            <label><span className="control-label">Market regime</span><input className="control-input" value={form.regime} onChange={(e) => setField('regime', e.target.value)} placeholder="Trending / high vol" data-testid="input-trade-regime" /></label>
          </div>
          <label><span className="control-label">Review notes <span className="font-normal normal-case tracking-normal">(optional)</span></span><textarea className="control-input min-h-24 resize-y" value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="What did you see? What would you repeat?" data-testid="textarea-trade-notes" /></label>
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <button type="button" className="btn-quiet" onClick={onClose} data-testid="button-cancel-trade">Cancel</button>
            <button type="submit" className="btn-primary" disabled={isPending} data-testid="button-save-trade"><Save size={15} />{isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Record trade'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}