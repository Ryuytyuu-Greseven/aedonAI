/** A row read from an uploaded lead sheet, as typed (not yet validated). */
export interface LeadSheetRow {
  fullName: string;
  phone: string;
  email: string;
}

const E164 = /^\+[1-9]\d{7,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Header names accepted for each column (compared lower-case, spaces/underscores ignored).
const HEADER_ALIASES: Record<keyof LeadSheetRow, string[]> = {
  fullName: ['name', 'fullname', 'customername', 'leadname', 'contactname'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'contact', 'contactnumber', 'number', 'whatsapp'],
  email: ['email', 'emailid', 'emailaddress', 'mail'],
};

/** CSV the "Download template" link hands out. */
export const LEAD_SHEET_TEMPLATE_CSV = 'Name,Phone,Email\nAsha Rao,9876543210,asha@example.com\n,+14155550199,\n';

/**
 * E.164 for a typed number — mirrors the server. With a dial code chosen it's prefixed (a leading
 * trunk 0 dropped); on "Auto", `+…` is kept and a bare 10-digit number is taken as Indian (+91).
 * Null when the number still needs a country code.
 */
export function resolveLeadPhone(raw: string, dialCode = ''): string | null {
  const cleaned = raw.replace(/[\s\-().]/g, '');
  if (!cleaned) return null;
  if (cleaned.startsWith('+')) return E164.test(cleaned) ? cleaned : null;
  if (dialCode) {
    const withCode = `${dialCode}${cleaned.replace(/^0+/, '')}`;
    return E164.test(withCode) ? withCode : null;
  }
  return /^\d{10}$/.test(cleaned) ? `+91${cleaned}` : null;
}

/** A row with nothing typed in it — skipped on submit rather than flagged. */
export function isBlankLeadRow(row: LeadSheetRow): boolean {
  return !row.fullName.trim() && !row.phone.trim() && !row.email.trim();
}

/** Same checks the server runs; only the phone is required. Empty when the row can be submitted. */
export function leadRowErrors(row: LeadSheetRow, dialCode = ''): string[] {
  const errors: string[] = [];
  if (!row.phone.trim()) errors.push('Phone is required');
  else if (!resolveLeadPhone(row.phone, dialCode)) {
    errors.push(dialCode ? 'Phone is not valid for this country' : 'Pick a country — only 10-digit numbers default to India');
  }
  if (row.email.trim() && !EMAIL.test(row.email.trim())) errors.push('Email is not valid');
  return errors;
}

/** Reads the first sheet of an .xlsx or a .csv into rows, keyed by its header row. */
export async function parseLeadSheet(file: File): Promise<LeadSheetRow[]> {
  const grid = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : await readXlsx(file);
  const rows = grid.filter((cells) => cells.some((cell) => cell.trim()));
  if (rows.length === 0) throw new Error('The sheet is empty');

  const headers = rows[0].map((h) => h.toLowerCase().replace(/[\s_\-.]/g, ''));
  const column = (key: keyof LeadSheetRow) => headers.findIndex((h) => HEADER_ALIASES[key].includes(h));
  const columns = { fullName: column('fullName'), phone: column('phone'), email: column('email') };
  // Name and Email columns are optional; only Phone is required.
  if (columns.phone === -1) {
    throw new Error('The first row needs a Phone column — see the template');
  }

  const cell = (cells: string[], index: number) => (index === -1 ? '' : (cells[index] ?? '').trim());
  return rows.slice(1).map((cells) => ({
    fullName: cell(cells, columns.fullName),
    phone: cell(cells, columns.phone),
    email: cell(cells, columns.email),
  }));
}

/** exceljs is loaded only when a sheet is actually uploaded. */
async function readXlsx(file: File): Promise<string[][]> {
  const exceljs = await import('exceljs');
  const Workbook = exceljs.Workbook ?? (exceljs as unknown as { default: typeof exceljs }).default.Workbook;
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('Could not read the file — upload an .xlsx or .csv');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook has no sheets');

  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // `text` is what Excel shows — handles numbers, hyperlinked emails and formulas.
    row.eachCell({ includeEmpty: true }, (cell, col) => (cells[col - 1] = cell.text ?? ''));
    grid.push(Array.from(cells, (cell) => cell ?? ''));
  });
  return grid;
}

/** Minimal RFC 4180 CSV: quoted fields, escaped quotes, CRLF/LF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
