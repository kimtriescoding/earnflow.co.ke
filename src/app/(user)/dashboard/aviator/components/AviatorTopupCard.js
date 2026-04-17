"use client";

export function AviatorTopupCard({
  walletBalance = 0,
  topupAmount = "",
  onTopupAmountChange,
  phoneNumber = "",
  onPhoneNumberChange,
  onTopup,
  toppingUp = false,
}) {
  return (
    <section className="card-surface rounded-[var(--radius-panel)] p-3.5 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="heading-display text-base font-semibold">Top up Aviator balance</h3>
        <div className="interactive-control flex h-9 items-center rounded-xl px-3 text-sm font-semibold">
          Aviator balance: KES {Number(walletBalance || 0).toFixed(2)}
        </div>
      </div>
      <p className="mt-1 text-xs muted-text">Aviator uses an isolated wallet. This balance is only for Aviator rounds.</p>
      <div className="mt-3 grid gap-2.5 md:grid-cols-[1fr_1fr_0.7fr]">
        <input
          type="number"
          min="1"
          step="0.01"
          value={topupAmount}
          onChange={(e) => onTopupAmountChange(e.target.value)}
          placeholder="Amount (KES)"
          className="interactive-control h-10 rounded-xl px-3 text-sm"
        />
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(e.target.value)}
          placeholder="Phone for checkout"
          className="interactive-control h-10 rounded-xl px-3 text-sm"
        />
        <button type="button" disabled={toppingUp} onClick={onTopup} className="primary-btn h-10 w-full px-3 py-2 text-sm">
          Top up
        </button>
      </div>
    </section>
  );
}
