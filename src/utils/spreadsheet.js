export function safeSpreadsheetText(value) {
  const text = String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim();
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function normalizedCell(cell) {
  if (cell?.type === 'Number' && Number.isFinite(Number(cell.value))) {
    return { value: Number(cell.value), type: 'Number' };
  }
  return { value: safeSpreadsheetText(cell?.value), type: 'String' };
}

function csvCell(cell) {
  const normalized = normalizedCell(cell);
  const value = normalized.type === 'Number' ? String(normalized.value) : normalized.value;
  return `"${value.replaceAll('"', '""')}"`;
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function createTabularExport({ format, sheetName, headers, rows }) {
  const headerCells = headers.map((value) => ({ value, type: 'String' }));
  const normalizedRows = rows.map((row) => row.map(normalizedCell));

  if (format === 'excel') {
    const safeSheetName = safeSpreadsheetText(sheetName).slice(0, 31) || 'Export';
    const rowXml = (cells) => `<Row>${cells.map((cell) => (
      `<Cell><Data ss:Type="${cell.type}">${escapeXml(cell.value)}</Data></Cell>`
    )).join('')}</Row>`;
    return {
      content: `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?>\n`
        + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" `
        + `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
        + `<Worksheet ss:Name="${escapeXml(safeSheetName)}"><Table>${rowXml(headerCells)}`
        + `${normalizedRows.map(rowXml).join('')}</Table></Worksheet></Workbook>`,
      extension: 'xls',
      mimeType: 'application/vnd.ms-excel;charset=utf-8',
    };
  }

  return {
    content: `\uFEFF${[headerCells, ...normalizedRows].map((row) => row.map(csvCell).join(',')).join('\r\n')}`,
    extension: 'csv',
    mimeType: 'text/csv;charset=utf-8',
  };
}

export function downloadClientFile(file, filename) {
  const blobUrl = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  return filename;
}
