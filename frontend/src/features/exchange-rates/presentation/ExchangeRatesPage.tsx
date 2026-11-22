import { useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Card } from '../../../shared/ui/Card';
import { Chip } from '../../../shared/ui/Chip';
import { Dialog } from '../../../shared/ui/Dialog';
import { InputField, SelectField } from '../../../shared/ui/Field';
import { Icon } from '../../../shared/ui/Icon';
import { PageContainer } from '../../../shared/ui/PageContainer';
import { PageHeading } from '../../../shared/ui/PageHeading';
import { LoadingState, ErrorState } from '../../../shared/ui/AsyncState';
import type { Currency, ExchangeRate, ExchangeRateDraft, ExchangeRateSource } from '../domain/exchangeRate';
import { useExchangeRates } from './hooks/useExchangeRates';
import './exchangeRates.css';

const cairoDateTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Africa/Cairo', dateStyle: 'medium', timeStyle: 'short',
});
const cairoInputDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
const numberFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
const currencyNames: Record<Currency, string> = { EUR: 'Euro', EGP: 'Egyptian Pound' };

function formatDate(value: string | null) {
  return value ? `${cairoDateTime.format(new Date(value))} Cairo` : 'Present';
}

function displayRate(rate: string) {
  const value = Number(rate);
  return Number.isFinite(value) ? numberFormat.format(value) : rate;
}

function currentCairoDateTime() {
  const parts = Object.fromEntries(cairoInputDateTime.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function cairoDateTimeToUtc(value: string) {
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wallTime = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallTime;
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const parts = Object.fromEntries(cairoInputDateTime.formatToParts(new Date(instant)).map(({ type, value: part }) => [type, part]));
    const cairoWallTime = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    instant = wallTime - (cairoWallTime - instant);
  }
  return new Date(instant);
}

function RateCard({ currency, rate }: { currency: Currency; rate?: ExchangeRate }) {
  return (
    <Card className="exchange-current-card">
      <div className="exchange-current-card__top">
        <span className={`exchange-currency-mark exchange-currency-mark--${currency.toLowerCase()}`} aria-hidden="true">{currency === 'EUR' ? '€' : 'E£'}</span>
        <Chip tone={rate ? 'success' : 'warning'}>{rate ? 'Current' : 'Not configured'}</Chip>
      </div>
      <div className="exchange-current-card__name">{currencyNames[currency]} <span>({currency})</span></div>
      <div className="exchange-current-card__rate">{rate ? displayRate(rate.rateToUsd) : '—'} <small>{currency} per 1 USD</small></div>
      <div className="exchange-current-card__meta">
        <span>Source</span><strong>{rate?.source ?? 'Not set'}</strong>
        <span>Effective from</span><strong>{rate ? formatDate(rate.effectiveFrom) : '—'}</strong>
      </div>
    </Card>
  );
}

export function ExchangeRatesPage() {
  const rates = useExchangeRates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [rateValue, setRateValue] = useState('');
  const [source, setSource] = useState<ExchangeRateSource>('MANUAL');
  const [effectiveFrom, setEffectiveFrom] = useState(currentCairoDateTime);
  const [formError, setFormError] = useState<string | null>(null);

  const currentByCurrency = new Map(rates.currentRates.map((rate) => [rate.currency, rate]));
  const totalPages = Math.max(1, Math.ceil(rates.history.total / rates.history.limit));
  const currentPage = Math.floor(rates.offset / rates.history.limit) + 1;

  function openAddDialog() {
    rates.clearMessages();
    setFormError(null);
    setRateValue('');
    setEffectiveFrom(currentCairoDateTime());
    setDialogOpen(true);
  }

  async function submitRate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsedRate = Number(rateValue);
    if (!rateValue.trim() || !Number.isFinite(parsedRate) || parsedRate <= 0) {
      setFormError('Enter a valid rate greater than zero.');
      return;
    }
    if (!/^\d{1,12}(?:\.\d{1,6})?$/.test(rateValue.trim())) {
      setFormError('Use up to 12 digits before and 6 digits after the decimal point.');
      return;
    }
    if (!effectiveFrom || Number.isNaN(new Date(effectiveFrom).getTime())) {
      setFormError('Choose a valid effective date and time.');
      return;
    }
    const effectiveTimestamp = cairoDateTimeToUtc(effectiveFrom).getTime();
    if (effectiveTimestamp > Date.now()) {
      setFormError('The effective date and time cannot be in the future.');
      return;
    }
    const previous = currentByCurrency.get(currency);
    if (previous && effectiveTimestamp <= new Date(previous.effectiveFrom).getTime()) {
      setFormError('The effective date must be later than the current rate.');
      return;
    }

    const draft: ExchangeRateDraft = {
      currency, rateToUsd: rateValue.trim(), source,
      effectiveFrom: cairoDateTimeToUtc(effectiveFrom).toISOString(),
    };
    if (previous && !window.confirm(`Add this ${currency} rate? The current rate will be preserved in history and marked as historical.`)) return;
    const created = await rates.createRate(draft);
    if (created) setDialogOpen(false);
  }

  return (
    <PageContainer>
      <PageHeading
        title="Settings"
        description="Manage the current exchange rates used for payments and financial records."
        actions={<Button variant="primary" onClick={openAddDialog}><Icon name="add" /> Add New Rate</Button>}
      />

      <div className="exchange-content">
        <Card className="exchange-base-card">
          <div className="exchange-section-heading">
            <div className="exchange-section-heading__icon"><Icon name="currency_exchange" /></div>
            <div><h2>Currency &amp; Exchange Rates</h2><p>Rates are stored as foreign currency units per 1 USD.</p></div>
            <Chip tone="info">USD base currency</Chip>
          </div>
          <div className="exchange-usd-row">
            <span className="exchange-currency-mark exchange-currency-mark--usd">$</span>
            <div><strong>US Dollar (USD)</strong><small>Base currency · fixed rate</small></div>
            <div className="exchange-usd-rate"><span>BASE RATE</span><strong>1.000000</strong></div>
            <Chip>BASE</Chip>
          </div>
          {rates.loading && rates.currentRates.length === 0 ? <LoadingState label="Loading current rates…" /> : rates.error && rates.currentRates.length === 0 ? (
            <div className="exchange-unavailable">Current exchange rates are unavailable until the connection is restored.</div>
          ) : (
            <div className="exchange-current-grid">
              <RateCard currency="EUR" rate={currentByCurrency.get('EUR')} />
              <RateCard currency="EGP" rate={currentByCurrency.get('EGP')} />
            </div>
          )}
        </Card>

        {rates.notice && <div className="exchange-message exchange-message--success" role="status">{rates.notice}</div>}
        {rates.error && <ErrorState message={rates.error} action={<Button onClick={() => void rates.load(rates.offset)}>Retry</Button>} />}

        <Card className="exchange-history-card">
          <div className="exchange-history-heading">
            <div><h2>Rate History</h2><p>Historical rates are retained for existing payments and tips.</p></div>
            <span className="exchange-history-count">{rates.history.total} records</span>
          </div>
          {rates.loading && rates.history.items.length === 0 ? <LoadingState label="Loading rate history…" /> : rates.error && rates.history.items.length === 0 ? (
            <div className="exchange-unavailable">Rate history is unavailable until the connection is restored.</div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="ui-table exchange-history-table">
                  <thead><tr><th scope="col">Currency</th><th scope="col">Rate</th><th scope="col">Source</th><th scope="col">Status</th><th scope="col">Effective period</th><th scope="col">Created</th></tr></thead>
                  <tbody>
                    {rates.history.items.length === 0 ? (
                      <tr><td className="ui-table__empty" colSpan={6}>No exchange-rate history yet. Add a rate to begin.</td></tr>
                    ) : rates.history.items.map((rate) => (
                      <tr key={rate.id}>
                        <td><strong>{currencyNames[rate.currency]}</strong><span className="exchange-table-currency">{rate.currency}</span></td>
                        <td className="exchange-table-rate">{displayRate(rate.rateToUsd)} <small>{rate.currency} / USD</small></td>
                        <td>{rate.source}</td>
                        <td><Chip tone={rate.isCurrent ? 'success' : 'neutral'}>{rate.isCurrent ? 'Current' : 'Historical'}</Chip></td>
                        <td>{formatDate(rate.effectiveFrom)} <span className="exchange-period-separator">→</span> {formatDate(rate.effectiveTo)}</td>
                        <td>{formatDate(rate.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rates.history.total > rates.history.limit && <div className="exchange-pagination">
                <span>Page {currentPage} of {totalPages}</span>
                <div><Button disabled={currentPage <= 1 || rates.loading} onClick={() => rates.setPage(Math.max(0, rates.offset - rates.history.limit))}>Previous</Button><Button disabled={currentPage >= totalPages || rates.loading} onClick={() => rates.setPage(rates.offset + rates.history.limit)}>Next</Button></div>
              </div>}
            </>
          )}
        </Card>
      </div>

      <Dialog open={dialogOpen} title="Add New Exchange Rate" description="A new rate preserves the existing rate as historical." onClose={() => !rates.submitting && setDialogOpen(false)}>
        <form className="exchange-form" onSubmit={(event) => void submitRate(event)}>
          <p className="exchange-form__direction">Enter how many foreign currency units equal <strong>1 USD</strong>.</p>
          <SelectField label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)}>
            <option value="EUR">EUR — Euro</option><option value="EGP">EGP — Egyptian Pound</option>
          </SelectField>
          <InputField label={`Rate (${currency} per 1 USD)`} type="text" inputMode="decimal" placeholder="0.000000" value={rateValue} onChange={(event) => setRateValue(event.target.value)} required />
          <SelectField label="Source" value={source} onChange={(event) => setSource(event.target.value as ExchangeRateSource)}>
            <option value="MANUAL">MANUAL</option><option value="CENTRAL_BANK">CENTRAL_BANK</option>
          </SelectField>
          <InputField label="Effective date and time (Cairo)" type="datetime-local" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required />
          {formError && <div className="exchange-message exchange-message--error" role="alert">{formError}</div>}
          <div className="exchange-form__actions">
            <Button disabled={rates.submitting} onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={rates.submitting}>{rates.submitting ? 'Saving…' : 'Add Exchange Rate'}</Button>
          </div>
        </form>
      </Dialog>
    </PageContainer>
  );
}
