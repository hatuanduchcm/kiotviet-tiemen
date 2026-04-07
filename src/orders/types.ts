export type OrderListItem = {
  orderCode: string;
  /** Raw text from the UI (e.g. '06/04/2026 22:10') */
  timeText: string;
};

export type OrdersExportResult = {
  downloadedPath: string;
  orderCodesExported: string[];
};
