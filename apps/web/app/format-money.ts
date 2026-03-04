/**
 * Format money in Kenyan Shillings (KES). Use across the app for consistency.
 */
export function formatMoney(amount: number): string {
  return `KES ${amount.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export const CURRENCY_LABEL = "KES";
