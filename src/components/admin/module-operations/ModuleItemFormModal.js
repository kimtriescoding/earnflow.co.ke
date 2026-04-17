"use client";

export function ModuleItemFormModal({
  open,
  itemForm,
  setItemForm,
  itemLabel,
  itemPlaceholder,
  itemDescriptionPlaceholder,
  itemRewardPlaceholder,
  showThresholdSeconds,
  descriptionMultiline,
  itemFields,
  itemSaveBusy,
  onClose,
  onSubmit,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="card-surface w-full max-w-2xl rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h4 className="heading-display text-base font-semibold">{itemForm.id ? `Edit ${itemLabel}` : `Add ${itemLabel}`}</h4>
          <button
            type="button"
            className="secondary-btn px-3 py-1.5 text-xs"
            disabled={itemSaveBusy}
            onClick={onClose}
          >
            Close
          </button>
        </div>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="interactive-control focus-ring w-full px-3.5 py-2.5 text-sm md:col-span-2"
            placeholder={itemPlaceholder}
            value={itemForm.title}
            onChange={(e) => setItemForm((prev) => ({ ...prev, title: e.target.value }))}
          />
          {descriptionMultiline ? (
            <textarea
              className="interactive-control focus-ring min-h-[88px] px-3.5 py-2.5 text-sm md:col-span-2"
              placeholder={itemDescriptionPlaceholder}
              value={itemForm.description}
              onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          ) : (
            <input
              className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
              placeholder={itemDescriptionPlaceholder}
              value={itemForm.description}
              onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          )}
          <input
            className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
            placeholder={itemRewardPlaceholder}
            type="number"
            value={itemForm.reward}
            onChange={(e) => setItemForm((prev) => ({ ...prev, reward: e.target.value }))}
          />
          {showThresholdSeconds ? (
            <input
              className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
              placeholder="Threshold seconds"
              type="number"
              value={itemForm.thresholdSeconds}
              onChange={(e) => setItemForm((prev) => ({ ...prev, thresholdSeconds: e.target.value }))}
            />
          ) : null}
          <select
            className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
            value={itemForm.status}
            onChange={(e) => setItemForm((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          {itemFields.map((field) => {
            const ph = field.placeholder || field.label;
            const val = itemForm[field.key] || "";
            if (field.type === "textarea") {
              return (
                <textarea
                  key={field.key}
                  className="interactive-control focus-ring min-h-[80px] px-3.5 py-2.5 text-sm md:col-span-2"
                  placeholder={ph}
                  value={val}
                  onChange={(e) => setItemForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              );
            }
            const inputType =
              field.type === "number" || field.type === "integer"
                ? "number"
                : field.type === "url"
                  ? "url"
                  : field.type === "datetime-local"
                    ? "datetime-local"
                    : field.type === "date"
                      ? "date"
                      : "text";
            return (
              <input
                key={field.key}
                className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                placeholder={ph}
                type={inputType}
                step={field.integer || field.type === "integer" ? 1 : undefined}
                value={val}
                onChange={(e) => setItemForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="primary-btn inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm"
              disabled={itemSaveBusy}
              aria-busy={itemSaveBusy}
            >
              {itemSaveBusy ? (
                <>
                  <span
                    className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-90"
                    aria-hidden
                  />
                  <span>Saving…</span>
                </>
              ) : itemForm.id ? (
                `Update ${itemLabel}`
              ) : (
                `Add ${itemLabel}`
              )}
            </button>
            <button type="button" className="secondary-btn px-4 py-2 text-sm" disabled={itemSaveBusy} onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
