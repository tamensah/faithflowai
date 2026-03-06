export type CsvImportPreview = {
  rawHeaders: string[];
  mappedHeaders: Array<{ source: string; target: string | null }>;
  unrecognizedHeaders: string[];
  recognizedCount: number;
  rowCount: number;
  sampleRows: Array<Record<string, string>>;
  readiness: Array<{ label: string; ok: boolean; detail: string }>;
};

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const char = csv[i];
    if (char === '"') {
      if (inQuotes && csv[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      row.push(value.trim());
      value = '';
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csv[i + 1] === '\n') i += 1;
      row.push(value.trim());
      value = '';
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }
    value += char;
  }

  if (value.length || row.length) {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function analyzeCsvImport(
  csv: string,
  aliases: Record<string, string>,
  readinessChecks: Array<{ label: string; check: (targets: Set<string>, headers: string[]) => { ok: boolean; detail: string } }>
): CsvImportPreview | null {
  const rows = parseCsvRows(csv);
  if (!rows.length) return null;

  const [headerRow, ...dataRows] = rows;
  const mappedHeaders = headerRow.map((header) => ({
    source: header,
    target: aliases[normalizeHeader(header)] ?? null,
  }));
  const recognizedTargets = new Set(mappedHeaders.map((entry) => entry.target).filter((value): value is string => Boolean(value)));

  const sampleRows = dataRows.slice(0, 3).map((row) => {
    const record: Record<string, string> = {};
    headerRow.forEach((header, index) => {
      record[header] = row[index] ?? '';
    });
    return record;
  });

  return {
    rawHeaders: headerRow,
    mappedHeaders,
    unrecognizedHeaders: mappedHeaders.filter((entry) => !entry.target).map((entry) => entry.source),
    recognizedCount: mappedHeaders.filter((entry) => entry.target).length,
    rowCount: dataRows.length,
    sampleRows,
    readiness: readinessChecks.map((item) => ({
      label: item.label,
      ...item.check(recognizedTargets, headerRow),
    })),
  };
}
