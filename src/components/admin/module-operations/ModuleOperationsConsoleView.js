"use client";

import { AdvancedTable } from "@/components/admin/AdvancedTable";
import { useModuleOperationsConsole } from "./useModuleOperationsConsole";
import { ModuleItemViewModal } from "./ModuleItemViewModal";
import { ModuleItemFormModal } from "./ModuleItemFormModal";
import { ReviewSubmissionDialog } from "./ReviewSubmissionDialog";

export function ModuleOperationsConsole(props) {
  const ctx = useModuleOperationsConsole(props);

  return (
    <div className="space-y-4">
      <div className="card-surface rounded-3xl p-6">
        <h2 className="heading-display text-lg font-semibold">{ctx.heading}</h2>
        <p className="mt-1 text-sm muted-text">{ctx.description}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex items-center gap-2 text-sm md:col-span-2 xl:col-span-3">
            <input type="checkbox" checked={ctx.enabled} onChange={(e) => ctx.setEnabled(e.target.checked)} />
            Module enabled
          </label>
          {ctx.configFields.map((field) => (
            <label key={field.key} className="grid gap-1 text-sm">
              <span className="muted-text">{field.label}</span>
              {field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(ctx.config[field.key])}
                  onChange={(e) => ctx.setConfig((prev) => ({ ...prev, [field.key]: e.target.checked }))}
                />
              ) : (
                <input
                  className="interactive-control focus-ring px-3.5 py-2.5 text-sm"
                  value={ctx.config[field.key]}
                  type={field.type === "number" ? "number" : "text"}
                  placeholder={field.placeholder || field.label}
                  onChange={(e) => ctx.setConfig((prev) => ({ ...prev, [field.key]: e.target.value }))}
                />
              )}
            </label>
          ))}
          <div className="md:col-span-2 xl:col-span-3">
            <button type="button" onClick={ctx.saveSettings} className="primary-btn w-fit px-4 py-2 text-sm">
              Save module settings
            </button>
          </div>
        </div>
      </div>

      {ctx.enableCrud && ctx.viewItemRow ? (
        <ModuleItemViewModal
          viewItemRow={ctx.viewItemRow}
          itemLabel={ctx.itemLabel}
          showThresholdSeconds={ctx.showThresholdSeconds}
          itemFields={ctx.itemFields}
          onClose={() => ctx.setViewItemRow(null)}
          onEdit={ctx.handleViewEdit}
        />
      ) : null}

      <ReviewSubmissionDialog
        reviewDialogRow={ctx.reviewDialogRow}
        reviewDialogStep={ctx.reviewDialogStep}
        reviewDialogChoice={ctx.reviewDialogChoice}
        setReviewDialogChoice={ctx.setReviewDialogChoice}
        setReviewDialogStep={ctx.setReviewDialogStep}
        reviewingEventId={ctx.reviewingEventId}
        moduleSlug={ctx.moduleSlug}
        closeReviewDialog={ctx.closeReviewDialog}
        confirmReviewFromDialog={ctx.confirmReviewFromDialog}
      />

      {ctx.enableCrud && ctx.itemModalOpen ? (
        <ModuleItemFormModal
          open
          itemForm={ctx.itemForm}
          setItemForm={ctx.setItemForm}
          itemLabel={ctx.itemLabel}
          itemPlaceholder={ctx.itemPlaceholder}
          itemDescriptionPlaceholder={ctx.itemDescriptionPlaceholder}
          itemRewardPlaceholder={ctx.itemRewardPlaceholder}
          showThresholdSeconds={ctx.showThresholdSeconds}
          descriptionMultiline={ctx.descriptionMultiline}
          itemFields={ctx.itemFields}
          itemSaveBusy={ctx.itemSaveBusy}
          onClose={ctx.closeItemModal}
          onSubmit={ctx.saveItem}
        />
      ) : null}

      {ctx.enableCrud ? (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button type="button" className="primary-btn px-4 py-2 text-sm" onClick={ctx.openAddItem}>
              Add {ctx.itemLabel}
            </button>
          </div>
          <AdvancedTable
            title={`Posted ${ctx.toLabel(ctx.itemLabel)}s`}
            columns={ctx.itemColumns}
            rows={ctx.filteredItems}
            total={ctx.filteredItems.length}
            page={1}
            pageSize={ctx.filteredItems.length || 1}
            search={ctx.search}
            sortState={{ field: "createdAt", direction: "desc" }}
            onSearchChange={ctx.setSearch}
            onSortChange={() => {}}
            onPageChange={() => {}}
            emptyLabel={`No ${ctx.itemLabel}s posted for this module yet.`}
          />
        </div>
      ) : null}

      <AdvancedTable
        title={
          ctx.enablePendingEarningReview && ctx.interactionColumns == null
            ? `${ctx.heading} — activity & reviews`
            : `${ctx.heading} — activity log`
        }
        columns={ctx.interactionTableColumns}
        rows={ctx.interactions}
        total={ctx.interactions.length}
        page={1}
        pageSize={ctx.interactions.length || 1}
        search=""
        sortState={{ field: "createdAt", direction: "desc" }}
        onSearchChange={() => {}}
        onSortChange={() => {}}
        onPageChange={() => {}}
        emptyLabel="No interactions logged yet."
      />
    </div>
  );
}
