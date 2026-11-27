/**
 * Returns true when invoice editing is enabled in settings and the document
 * date falls within the configured edit window (default 30 days).
 */
export const isWithinEditWindow = (
  dateValue?: string | Date | null,
  settings?: { enableInvoiceEdit?: boolean; invoiceEditDays?: number } | null,
): boolean => {
  if (!settings?.enableInvoiceEdit || !dateValue) return false;
  const docTime = new Date(dateValue).getTime();
  if (Number.isNaN(docTime)) return false;
  const editDays = Number(settings.invoiceEditDays) || 30;
  const cutoff = Date.now() - editDays * 24 * 60 * 60 * 1000;
  return docTime >= cutoff;
};

