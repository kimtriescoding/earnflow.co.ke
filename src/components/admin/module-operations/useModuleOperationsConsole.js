"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { normalizeConfig, formatCompactDateTime, toLabel, getFieldValue, valueForItemFieldInput } from "./consoleUtils";
import { buildItemColumns, buildDefaultInteractionColumns } from "./buildModuleConsoleColumns";

export function useModuleOperationsConsole({
  moduleSlug,
  heading,
  description,
  configFields = [],
  defaultItemReward = 0,
  itemPlaceholder = "New item title",
  itemDescriptionPlaceholder = "Description",
  itemRewardPlaceholder = "Reward (KES)",
  itemFields = [],
  itemLabel = "item",
  enableCrud = true,
  interactionColumns = null,
  showThresholdSeconds = true,
  descriptionMultiline = false,
  collapseScheduleInTable = false,
  itemTableShowBrief = true,
  itemTableOmitKeys = [],
  enablePendingEarningReview = true,
}) {
  const emptyItemForm = useMemo(
    () => ({
      id: "",
      title: "",
      description: "",
      reward: String(defaultItemReward),
      thresholdSeconds: "",
      status: "active",
      ...Object.fromEntries(itemFields.map((field) => [field.key, ""])),
    }),
    [defaultItemReward, itemFields]
  );

  const [enabled, setEnabled] = useState(true);
  const [config, setConfig] = useState(() => normalizeConfig({}, configFields));
  const [items, setItems] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const [search, setSearch] = useState("");
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [viewItemRow, setViewItemRow] = useState(null);
  const [reviewingEventId, setReviewingEventId] = useState(null);
  const [reviewDialogRow, setReviewDialogRow] = useState(null);
  const [reviewDialogStep, setReviewDialogStep] = useState(1);
  const [reviewDialogChoice, setReviewDialogChoice] = useState(null);
  const [itemSaveBusy, setItemSaveBusy] = useState(false);
  const [itemDeleteId, setItemDeleteId] = useState(null);

  const closeReviewDialog = useCallback(() => {
    setReviewDialogRow(null);
    setReviewDialogStep(1);
    setReviewDialogChoice(null);
  }, []);

  const load = useCallback(async () => {
    const [settingsRes, itemsRes, interactionsRes] = await Promise.all([
      fetch(`/api/admin/modules/${moduleSlug}/settings`).then((res) => res.json()),
      fetch(`/api/admin/modules/${moduleSlug}/items?page=1&pageSize=100`).then((res) => res.json()),
      fetch(`/api/admin/modules/${moduleSlug}/interactions?page=1&pageSize=100`).then((res) => res.json()),
    ]);
    if (settingsRes?.success) {
      setEnabled(Boolean(settingsRes.data?.enabled));
      setConfig(normalizeConfig(settingsRes.data?.config || {}, configFields));
    }
    if (itemsRes?.success) setItems(itemsRes.data || []);
    if (interactionsRes?.success) {
      setInteractions(interactionsRes.data || []);
    }
  }, [moduleSlug, configFields]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => String(item.title || "").toLowerCase().includes(q));
  }, [items, search]);

  async function saveSettings() {
    const payload = {};
    for (const field of configFields) {
      if (field.type === "number") payload[field.key] = Number(config[field.key] || 0);
      else if (field.type === "checkbox") payload[field.key] = Boolean(config[field.key]);
      else payload[field.key] = config[field.key];
    }
    const res = await fetch(`/api/admin/modules/${moduleSlug}/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, config: payload }),
    });
    const data = await res.json();
    if (data.success) toast.success("Module settings updated.");
    else toast.error(data.message || "Failed to update module settings.");
  }

  async function saveItem(e) {
    e.preventDefault();
    setItemSaveBusy(true);
    try {
      const dynamicRootUpdates = {};
      const existing = itemForm.id ? items.find((i) => String(i._id) === String(itemForm.id)) : null;
      const mergedMetadata = { ...(existing?.metadata && typeof existing.metadata === "object" ? existing.metadata : {}) };

      for (const field of itemFields) {
        const raw = itemForm[field.key];
        if (field.target === "root") {
          if (field.type === "number" || field.type === "integer") {
            const n = Number(raw || 0);
            const useInt = field.integer || field.type === "integer";
            dynamicRootUpdates[field.key] = useInt ? Math.max(0, Math.floor(n)) : n;
          } else if (field.type === "textarea") {
            dynamicRootUpdates[field.key] = String(raw || "").trim();
          } else {
            dynamicRootUpdates[field.key] = String(raw || "").trim();
          }
        } else if (field.type === "datetime-local") {
          const s = String(raw || "").trim();
          if (!s) delete mergedMetadata[field.key];
          else {
            const d = new Date(s);
            if (!Number.isNaN(d.getTime())) mergedMetadata[field.key] = d.toISOString();
          }
        } else if (field.type === "date") {
          const s = String(raw || "").trim();
          if (!s) delete mergedMetadata[field.key];
          else {
            const d = new Date(`${s}T12:00:00`);
            if (!Number.isNaN(d.getTime())) mergedMetadata[field.key] = d.toISOString();
          }
        } else if (field.type === "number" || field.type === "integer") {
          const n = Number(raw || 0);
          const useInt = field.integer || field.type === "integer";
          mergedMetadata[field.key] = useInt ? Math.max(0, Math.floor(n)) : n;
        } else if (field.type === "textarea") {
          const t = String(raw || "").trim();
          if (!t) delete mergedMetadata[field.key];
          else mergedMetadata[field.key] = t;
        } else {
          const t = String(raw || "").trim();
          if (!t) delete mergedMetadata[field.key];
          else mergedMetadata[field.key] = t;
        }
      }

      const body = {
        title: itemForm.title,
        description: itemForm.description,
        reward: Number(itemForm.reward || 0),
        thresholdSeconds: showThresholdSeconds ? Number(itemForm.thresholdSeconds || 0) : Number(existing?.thresholdSeconds || 0),
        status: itemForm.status,
        ...dynamicRootUpdates,
        metadata: mergedMetadata,
      };
      const endpoint = itemForm.id
        ? `/api/admin/modules/${moduleSlug}/items/${itemForm.id}`
        : `/api/admin/modules/${moduleSlug}/items`;
      const method = itemForm.id ? "PATCH" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Unable to save item.");
        return;
      }
      toast.success(itemForm.id ? `${toLabel(itemLabel)} updated.` : `${toLabel(itemLabel)} added.`);
      setItemForm(emptyItemForm);
      setItemModalOpen(false);
      load().catch(() => {});
    } finally {
      setItemSaveBusy(false);
    }
  }

  const deleteItem = useCallback(
    async (id) => {
      const confirmed = window.confirm("Delete this module item?");
      if (!confirmed) return;
      const sid = String(id || "");
      setItemDeleteId(sid);
      try {
        const res = await fetch(`/api/admin/modules/${moduleSlug}/items/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
          toast.success("Item deleted.");
          load().catch(() => {});
          return;
        }
        toast.error(data.message || "Failed to delete item.");
      } finally {
        setItemDeleteId(null);
      }
    },
    [moduleSlug, load]
  );

  async function submitPendingReview(eventId, action) {
    const id = String(eventId || "").trim();
    if (!id) return false;
    setReviewingEventId(id);
    try {
      const res = await fetch("/api/admin/earnings/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id, action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Updated.");
        await load();
        return true;
      }
      toast.error(data.message || "Review failed.");
      return false;
    } catch {
      toast.error("Review failed.");
      return false;
    } finally {
      setReviewingEventId(null);
    }
  }

  async function confirmReviewFromDialog() {
    const row = reviewDialogRow;
    const choice = reviewDialogChoice;
    if (!row || (choice !== "approve" && choice !== "reject")) return;
    const eid = String(row.earningEventId || "").trim();
    if (!eid) return;
    const okResult = await submitPendingReview(eid, choice);
    if (okResult) closeReviewDialog();
  }

  const scheduleKeys = new Set(["startsAt", "deadline"]);
  const canCollapseSchedule =
    collapseScheduleInTable && itemFields.some((f) => f.key === "startsAt") && itemFields.some((f) => f.key === "deadline");
  const omitSet = new Set(itemTableOmitKeys || []);
  const baseItemFieldsForTable = canCollapseSchedule ? itemFields.filter((f) => !scheduleKeys.has(f.key)) : itemFields;
  const itemFieldsForTable = baseItemFieldsForTable.filter((f) => !omitSet.has(f.key));

  const scheduleColumn = useMemo(
    () =>
      canCollapseSchedule
        ? [
            {
              field: "_scheduleWindow",
              header: "Window",
              sortable: false,
              render: (row) => {
                const m = row.metadata || {};
                const start = formatCompactDateTime(m.startsAt);
                const end = formatCompactDateTime(m.deadline);
                if (!start && !end) return <span className="muted-text">—</span>;
                const label = [start || "…", end || "…"].join(" → ");
                const full = [m.startsAt, m.deadline].filter(Boolean).join(" / ");
                return (
                  <span title={full || undefined} className="block max-w-[9.5rem] text-xs leading-tight text-[var(--foreground)]">
                    {label}
                  </span>
                );
              },
            },
          ]
        : [],
    [canCollapseSchedule]
  );

  const itemColumns = useMemo(
    () =>
      buildItemColumns({
        itemTableShowBrief,
        scheduleColumn,
        itemFieldsForTable,
        itemFields,
        setViewItemRow,
        setItemForm,
        setItemModalOpen,
        deleteItem,
        itemDeleteId,
      }),
    [itemTableShowBrief, scheduleColumn, itemFieldsForTable, itemFields, itemDeleteId, deleteItem]
  );

  const defaultInteractionColumns = useMemo(
    () =>
      buildDefaultInteractionColumns({
        moduleSlug,
        enablePendingEarningReview,
        interactionColumns,
        reviewingEventId,
        setReviewDialogRow,
        setReviewDialogStep,
        setReviewDialogChoice,
      }),
    [moduleSlug, enablePendingEarningReview, interactionColumns, reviewingEventId]
  );

  const interactionTableColumns = interactionColumns || defaultInteractionColumns;

  const closeItemModal = useCallback(() => {
    setItemModalOpen(false);
    setItemForm(emptyItemForm);
  }, [emptyItemForm]);

  const openAddItem = useCallback(() => {
    setItemForm(emptyItemForm);
    setItemModalOpen(true);
  }, [emptyItemForm]);

  const handleViewEdit = useCallback(
    (row) => {
      setViewItemRow(null);
      setItemForm({
        id: row._id,
        title: row.title || "",
        description: row.description || "",
        reward: String(row.reward || 0),
        thresholdSeconds: String(row.thresholdSeconds || ""),
        status: row.status || "active",
        ...Object.fromEntries(itemFields.map((field) => [field.key, valueForItemFieldInput(field, getFieldValue(row, field))])),
      });
      setItemModalOpen(true);
    },
    [itemFields]
  );

  return {
    heading,
    description,
    moduleSlug,
    itemLabel,
    enableCrud,
    itemPlaceholder,
    itemDescriptionPlaceholder,
    itemRewardPlaceholder,
    showThresholdSeconds,
    descriptionMultiline,
    itemFields,
    configFields,
    enabled,
    setEnabled,
    config,
    setConfig,
    saveSettings,
    search,
    setSearch,
    filteredItems,
    interactions,
    itemColumns,
    interactionTableColumns,
    enablePendingEarningReview,
    interactionColumns,
    viewItemRow,
    setViewItemRow,
    itemModalOpen,
    setItemModalOpen,
    itemForm,
    setItemForm,
    itemSaveBusy,
    saveItem,
    closeItemModal,
    openAddItem,
    reviewDialogRow,
    reviewDialogStep,
    reviewDialogChoice,
    setReviewDialogChoice,
    setReviewDialogStep,
    reviewingEventId,
    closeReviewDialog,
    confirmReviewFromDialog,
    handleViewEdit,
    toLabel,
  };
}
