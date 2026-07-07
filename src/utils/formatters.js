export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const formatNumber = (value, digits = 2) =>
  new Intl.NumberFormat('en-US', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value || 0));

export const formatPercent = (value) => `${formatNumber(Number(value || 0) * 100, 2)}%`;

export const pnlClassName = (value) => {
  const number = Number(value || 0);
  if (number > 0) return 'positive';
  if (number < 0) return 'negative';
  return 'neutral';
};
