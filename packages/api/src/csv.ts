function escapeValue(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/\"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T extends Record<string, unknown>>(rows: T[], headers: { key: keyof T; label: string }[]) {
  const headerRow = headers.map((header) => escapeValue(header.label)).join(',');
  const lines = rows.map((row) =>
    headers
      .map((header) => escapeValue(row[header.key]))
      .join(',')
  );
  return [headerRow, ...lines].join('\n');
}
