const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

export function currentPeriod() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export function comparePeriodsDesc(a = '', b = '') {
  const aSanitized = String(a).trim();
  const bSanitized = String(b).trim();
  const aValid = PERIOD_PATTERN.test(aSanitized);
  const bValid = PERIOD_PATTERN.test(bSanitized);

  if (aValid && bValid) {
    if (aSanitized === bSanitized) return 0;
    return aSanitized < bSanitized ? 1 : -1;
  }

  if (aValid) return -1;
  if (bValid) return 1;
  return aSanitized.localeCompare(bSanitized);
}

export function formatPeriodLabel(period = '') {
  const sanitized = String(period).trim();
  const match = PERIOD_PATTERN.exec(sanitized);
  if (!match) return sanitized || 'Sem período';

  const [, year, month] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return sanitized || 'Sem período';
  }
  const formatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
  const label = formatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
