import { ForbiddenException } from '@nestjs/common';

/**
 * Ensures invoice/estimation editing is enabled in Settings and the document
 * date falls within the configured edit window.
 */
export async function assertEditableBySettings(
  tx: any,
  documentDate: Date | string,
  documentLabel: string,
): Promise<void> {
  const settings = await tx.settings.findUnique({ where: { id: 1 } });
  if (!settings?.enableInvoiceEdit) {
    throw new ForbiddenException('Invoice editing is disabled in Settings.');
  }

  const docTime = new Date(documentDate).getTime();
  const editDays = settings?.invoiceEditDays || 30;
  const cutoff = Date.now() - editDays * 24 * 60 * 60 * 1000;
  if (docTime < cutoff) {
    throw new ForbiddenException(
      `${documentLabel} can only be edited within ${editDays} days of its date.`,
    );
  }
}

