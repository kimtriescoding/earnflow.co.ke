"use client";

export function AviatorBetPanel({
  betAmount = "10",
  setBetAmount,
  minBetAmount = 10,
  onPlaceBet,
  placeDisabled = false,
  onCashout,
  cashoutDisabled = true,
  placing = false,
  cashingOut = false,
}) {
  return (
    <div className="border-t border-slate-900/90 p-3">
      <div className="w-full rounded-2xl border border-slate-700/70 bg-[#11141f] p-3">
        <div className="mx-auto flex w-fit overflow-hidden rounded-full border border-slate-700 bg-[#0d111b] text-xs">
          <span className="bg-[#2c2f3a] px-6 py-1.5 text-white">Bet</span>
          <span className="px-6 py-1.5 text-slate-300">Manual</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBetAmount((v) => String(Math.max(Number(minBetAmount || 10), Number(v || 0) - 10)))}
            className="h-8 w-8 rounded-full border border-slate-600 text-slate-300 transition hover:border-slate-400"
          >
            -
          </button>
          <input
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            type="number"
            min={minBetAmount || 10}
            step="0.01"
            className="interactive-control h-9 w-full rounded-xl !border-slate-600 !bg-[#0d111b] px-3 text-sm !text-white placeholder:!text-slate-400"
          />
          <button type="button" onClick={() => setBetAmount((v) => String(Number(v || 0) + 10))} className="h-8 w-8 rounded-full border border-slate-600 text-slate-300 transition hover:border-slate-400">
            +
          </button>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {["100", "200", "500", "1000"].map((chip) => (
            <button key={chip} type="button" onClick={() => setBetAmount(chip)} className="rounded-lg border border-slate-700 bg-[#0d111b] px-2 py-1 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white">
              {chip}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onPlaceBet}
            disabled={placing || placeDisabled}
            className="w-full rounded-xl border border-green-300/60 bg-[#25b700] px-4 py-2 text-base font-semibold text-white disabled:opacity-60"
          >
            Place Bet
          </button>
          <button
            type="button"
            onClick={onCashout}
            disabled={cashingOut || cashoutDisabled}
            className="w-full rounded-xl border border-amber-300/60 bg-[#d97706] px-4 py-2 text-base font-semibold text-white disabled:opacity-60"
          >
            Cashout
          </button>
        </div>
        <p className="mt-2 text-center text-sm text-slate-300">Bet Amount: KES {Number(betAmount || 0).toFixed(2)}</p>
      </div>
    </div>
  );
}
