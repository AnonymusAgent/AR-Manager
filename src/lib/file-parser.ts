import * as XLSX from 'xlsx';

export interface ParsedClaimData {
  claimNumber?: string;
  accountNumber?: string;
  patientName?: string;
  dateOfService?: string;
  cptCodes?: string;
  diagnosisCode?: string;
  provider?: string;
  insurance?: string;
  payer?: string;
  billedAmount?: string;
  paidAmount?: string;
  balance?: string;
  status?: string;
  denialReason?: string;
  location?: string;
  additionalData?: Record<string, unknown>;
  [key: string]: string | Record<string, unknown> | undefined;
}

export interface CanonicalFieldDefinition {
  key: string;
  label: string;
  description: string;
  required?: boolean;
  type: 'string' | 'date' | 'amount' | 'number';
}

export const CANONICAL_FIELDS: CanonicalFieldDefinition[] = [
  { key: 'claimNumber', label: 'Claim Number', description: 'Primary claim or encounter identifier', required: true, type: 'string' },
  { key: 'accountNumber', label: 'Account / Chart #', description: 'Patient account number or MRN', type: 'string' },
  { key: 'patientName', label: 'Patient / Member Name', description: 'Full name of the patient or subscriber', required: true, type: 'string' },
  { key: 'dateOfService', label: 'Date of Service (DOS)', description: 'Treatment or service date', type: 'date' },
  { key: 'billedAmount', label: 'Billed Amount ($)', description: 'Total charge billed to insurance', required: true, type: 'amount' },
  { key: 'paidAmount', label: 'Paid Amount ($)', description: 'Amount reimbursed or paid', type: 'amount' },
  { key: 'balance', label: 'Outstanding Balance ($)', description: 'Remaining AR balance due', type: 'amount' },
  { key: 'insurance', label: 'Insurance / Payer Name', description: 'Health insurance carrier name', type: 'string' },
  { key: 'payer', label: 'Payer ID / Clearinghouse', description: 'Electronic payer ID or plan code', type: 'string' },
  { key: 'provider', label: 'Rendering Provider', description: 'Physician, clinician, or provider NPI', type: 'string' },
  { key: 'cptCodes', label: 'CPT / Procedure Code', description: 'Procedure, HCPCS, or service code', type: 'string' },
  { key: 'diagnosisCode', label: 'Diagnosis (ICD-10)', description: 'Primary diagnosis or ICD code', type: 'string' },
  { key: 'status', label: 'Payer Claim Status', description: 'Reported claim status (New, Pending, Denied)', type: 'string' },
  { key: 'denialReason', label: 'Denial Reason / CARC', description: 'CARC, RARC, or reason remarks', type: 'string' },
  { key: 'location', label: 'Location / Facility', description: 'Place of service or clinic name', type: 'string' },
];

export const COLUMN_MAPPINGS: Record<string, string[]> = {
  claimNumber: [
    'claim number', 'claim no', 'claim #', 'claim_number', 'claimno', 'claim id', 'claimid',
    'voucher', 'voucher #', 'doc no', 'document number', 'bill #', 'bill no', 'control #',
    'claim identifier', 'encounter id', 'ticket #',
  ],
  accountNumber: [
    'account number', 'account no', 'account #', 'account_number', 'acct no', 'acct number',
    'acct #', 'patient account', 'patient acct', 'chart #', 'chart number', 'mrn', 'medical record #',
    'patient id', 'account id',
  ],
  patientName: [
    'patient name', 'patient', 'pt name', 'name', 'patient_name', 'member name', 'member',
    'subscriber name', 'subscriber', 'insured name', 'client name', 'patient full name',
  ],
  dateOfService: [
    'date of service', 'dos', 'service date', 'date_of_service', 'from date', 'svc date',
    'service from', 'service_date', 'treatment date', 'visit date', 'dos from', 'service_from',
  ],
  cptCodes: [
    'cpt', 'cpt code', 'cpt codes', 'procedure code', 'procedure', 'proc code', 'hcpcs',
    'service code', 'cpt/hcpcs', 'procedure codes', 'proc',
  ],
  diagnosisCode: [
    'diagnosis', 'diagnosis code', 'dx', 'dx code', 'icd', 'icd-10', 'icd 10', 'primary dx',
    'diag code', 'icd code', 'primary diagnosis',
  ],
  provider: [
    'provider', 'provider name', 'rendering provider', 'physician', 'doctor', 'npi',
    'rendering physician', 'billing provider', 'attending', 'doctor name',
  ],
  insurance: [
    'insurance', 'insurance name', 'ins name', 'carrier', 'insurance company', 'plan name',
    'payer/plan', 'health plan', 'insurance carrier', 'primary insurance',
  ],
  payer: [
    'payer', 'payer name', 'payor', 'payor name', 'payer id', 'payor id', 'clearinghouse payer',
  ],
  billedAmount: [
    'billed amount', 'billed', 'charge', 'charges', 'total charges', 'amount billed',
    'billed_amount', 'claim amount', 'gross charges', 'fee', 'charge amount', 'total charge',
  ],
  paidAmount: [
    'paid amount', 'paid', 'payment', 'amount paid', 'paid_amount', 'reimbursement',
    'ins paid', 'insurance paid', 'payer payment', 'insurance payment',
  ],
  balance: [
    'balance', 'balance due', 'amount due', 'outstanding', 'remaining', 'patient balance',
    'total balance', 'current balance', 'ar balance', 'claim balance', 'remaining balance',
  ],
  status: [
    'status', 'claim status', 'state', 'ar status', 'claim_status', 'current status',
  ],
  denialReason: [
    'denial reason', 'denial code', 'carc', 'rarc', 'reason code', 'rejection reason',
    'remark', 'denial description', 'denial_reason', 'remark code', 'adjustment reason',
  ],
  location: [
    'location', 'pos', 'place of service', 'facility', 'clinic', 'site', 'office', 'service location',
  ],
};

export function normalizeColumnName(col: string): string {
  return String(col || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findFieldMapping(columnName: string): string | null {
  const normalized = normalizeColumnName(columnName);
  if (!normalized) return null;

  // 1. Exact match in patterns
  for (const [field, patterns] of Object.entries(COLUMN_MAPPINGS)) {
    for (const pattern of patterns) {
      if (normalized === pattern) return field;
    }
  }

  // 2. Exact word boundaries or includes
  for (const [field, patterns] of Object.entries(COLUMN_MAPPINGS)) {
    for (const pattern of patterns) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        return field;
      }
    }
  }

  return null;
}

export function parseExcelDate(value: unknown): string | undefined {
  if (!value) return undefined;

  // 1. Excel serial number date
  if (typeof value === 'number') {
    try {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (parsed && parsed.y && parsed.m && parsed.d) {
        const y = parsed.y;
        const m = String(parsed.m).padStart(2, '0');
        const d = String(parsed.d).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
    } catch {}
  }

  // 2. Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString().split('T')[0];
  }

  // 3. String date formats
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'n/a' || trimmed.toLowerCase() === 'null') {
      return undefined;
    }

    // YYYY-MM-DD
    const isoMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (isoMatch) {
      const y = isoMatch[1];
      const m = isoMatch[2].padStart(2, '0');
      const d = isoMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // MM/DD/YYYY or M/D/YYYY
    const usMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
    if (usMatch) {
      const m = usMatch[1].padStart(2, '0');
      const d = usMatch[2].padStart(2, '0');
      const y = usMatch[3];
      return `${y}-${m}-${d}`;
    }

    // Fallback Date.parse
    const timestamp = Date.parse(trimmed);
    if (!isNaN(timestamp)) {
      const dt = new Date(timestamp);
      return dt.toISOString().split('T')[0];
    }
  }

  // Never return an unparseable arbitrary string to prevent Postgres DATE syntax errors!
  return undefined;
}

export function parseAmount(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  if (typeof value === 'number') {
    if (isNaN(value)) return undefined;
    return value.toFixed(2);
  }

  if (typeof value === 'string') {
    let clean = value.trim();
    if (clean === '-' || clean.toLowerCase() === 'n/a' || clean === '') {
      return '0.00';
    }

    // Accounting format negative e.g. ($1,234.56) or (1234.56)
    let isNegative = false;
    if (clean.startsWith('(') && clean.endsWith(')')) {
      isNegative = true;
      clean = clean.slice(1, -1);
    } else if (clean.endsWith('-')) {
      isNegative = true;
      clean = clean.slice(0, -1);
    } else if (clean.startsWith('-')) {
      isNegative = true;
      clean = clean.slice(1);
    }

    clean = clean.replace(/[$€£,\s]/g, '');
    const num = parseFloat(clean);
    if (isNaN(num)) return undefined;

    const finalVal = isNegative ? -num : num;
    return finalVal.toFixed(2);
  }

  return undefined;
}

export interface WorkbookInspection {
  fileName: string;
  fileType: string;
  sheets: string[];
  selectedSheet: string;
  headerRowIndex: number;
  headers: string[];
  totalDataRows: number;
  columnSamples: Record<string, string[]>;
  suggestedMapping: Record<string, string>; // original header -> canonical field key
  sampleRows: Array<Record<string, unknown>>;
  hasRequiredFields: boolean;
  warnings: string[];
}

/**
 * Intelligently inspects a workbook buffer, detects sheets, auto-detects header row,
 * column names, fuzzy field mappings, and extracts preview sample records.
 */
export function inspectWorkbook(
  buffer: Buffer,
  fileName: string,
  preferredSheet?: string
): WorkbookInspection {
  const fileType = fileName.split('.').pop()?.toLowerCase() || 'xlsx';
  const warnings: string[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: true,
      raw: false,
      dateNF: 'yyyy-mm-dd',
    });
  } catch (err: any) {
    throw new Error(`The Excel file could not be read or is corrupted. Details: ${err.message}`);
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('No worksheets were found in the uploaded workbook.');
  }

  const sheets = workbook.SheetNames;
  const selectedSheet = preferredSheet && sheets.includes(preferredSheet) ? preferredSheet : sheets[0];
  const worksheet = workbook.Sheets[selectedSheet];

  if (!worksheet) {
    throw new Error(`Worksheet '${selectedSheet}' could not be accessed.`);
  }

  // Convert raw rows
  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown[][];

  if (rawRows.length === 0) {
    throw new Error(`Worksheet '${selectedSheet}' is empty.`);
  }

  // Auto-detect header row index: scan first 10 rows for recognizable headers
  let headerRowIndex = 0;
  let bestScore = -1;

  for (let r = 0; r < Math.min(12, rawRows.length); r++) {
    const row = rawRows[r] as unknown[];
    if (!row || row.length === 0) continue;

    let recognizedCols = 0;
    for (const cell of row) {
      if (cell && typeof cell === 'string' && cell.trim()) {
        const mapping = findFieldMapping(cell.trim());
        if (mapping) recognizedCols++;
      }
    }

    if (recognizedCols > bestScore) {
      bestScore = recognizedCols;
      headerRowIndex = r;
    }
  }

  if (bestScore === 0) {
    warnings.push(
      'No standard medical billing column headers were automatically detected. You can map columns manually in the preview below.'
    );
  }

  const rawHeaders = (rawRows[headerRowIndex] || []) as string[];
  const headers: string[] = [];
  const suggestedMapping: Record<string, string> = {};
  const columnSamples: Record<string, string[]> = {};

  rawHeaders.forEach((h, colIdx) => {
    const colName = h !== undefined && h !== null && String(h).trim() !== ''
      ? String(h).trim()
      : `Column_${colIdx + 1}`;

    headers.push(colName);
    const mappedField = findFieldMapping(colName);
    if (mappedField) {
      suggestedMapping[colName] = mappedField;
    }

    // Extract sample non-empty values
    const samples: string[] = [];
    for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 25, rawRows.length); r++) {
      const val = rawRows[r]?.[colIdx];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
        const strVal = String(val).trim();
        if (!samples.includes(strVal)) samples.push(strVal);
        if (samples.length >= 3) break;
      }
    }
    columnSamples[colName] = samples;
  });

  const totalDataRows = Math.max(0, rawRows.length - (headerRowIndex + 1));

  // Extract first 10 data rows for live preview
  const sampleRows: Array<Record<string, unknown>> = [];
  for (let r = headerRowIndex + 1; r < Math.min(headerRowIndex + 11, rawRows.length); r++) {
    const row = rawRows[r] as unknown[];
    if (!row || row.length === 0) continue;
    const rowObj: Record<string, unknown> = {};
    headers.forEach((hdr, idx) => {
      rowObj[hdr] = row[idx] !== undefined && row[idx] !== null ? row[idx] : '';
    });
    sampleRows.push(rowObj);
  }

  const mappedKeys = Object.values(suggestedMapping);
  const hasClaimOrPatient =
    mappedKeys.includes('claimNumber') ||
    mappedKeys.includes('patientName') ||
    mappedKeys.includes('accountNumber');

  return {
    fileName,
    fileType,
    sheets,
    selectedSheet,
    headerRowIndex,
    headers,
    totalDataRows,
    columnSamples,
    suggestedMapping,
    sampleRows,
    hasRequiredFields: hasClaimOrPatient,
    warnings,
  };
}

/**
 * Parses full workbook data using verified user column mappings.
 * Robust against empty lines, invalid dates, malformed currency, and duplicate records.
 */
export function parseWorkbookWithMapping(
  buffer: Buffer,
  options: {
    sheetName?: string;
    headerRowIndex?: number;
    columnMapping: Record<string, string>; // original header -> canonical field
  }
): {
  records: ParsedClaimData[];
  stats: {
    totalRows: number;
    validRecords: number;
    skippedRows: number;
    duplicatesInFile: number;
  };
  warnings: string[];
} {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: true,
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  const sheetName = options.sheetName && workbook.SheetNames.includes(options.sheetName)
    ? options.sheetName
    : workbook.SheetNames[0];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    throw new Error(`Worksheet '${sheetName}' was not found.`);
  }

  const rawRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
    blankrows: false,
  }) as unknown[][];

  const headerRowIndex = options.headerRowIndex ?? 0;
  const rawHeaders = (rawRows[headerRowIndex] || []) as string[];
  const headers = rawHeaders.map((h, i) => (h && String(h).trim()) || `Column_${i + 1}`);

  const mapping = options.columnMapping || {};
  const records: ParsedClaimData[] = [];
  const seenClaimNumbers = new Set<string>();
  let duplicatesInFile = 0;
  let skippedRows = 0;
  let invalidDateCount = 0;
  const warnings: string[] = [];

  for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r] as unknown[];
    if (!row || row.length === 0) {
      skippedRows++;
      continue;
    }

    const claim: ParsedClaimData = {};
    const additionalData: Record<string, unknown> = {};

    headers.forEach((hdr, colIdx) => {
      const val = row[colIdx];
      const targetField = mapping[hdr];

      if (val !== undefined && val !== null && String(val).trim() !== '') {
        if (targetField && targetField !== 'ignore') {
          if (targetField === 'dateOfService') {
            const parsedDt = parseExcelDate(val);
            if (parsedDt) {
              claim.dateOfService = parsedDt;
            } else {
              invalidDateCount++;
              additionalData[`raw_${hdr}`] = String(val);
            }
          } else if (['billedAmount', 'paidAmount', 'balance'].includes(targetField)) {
            const amt = parseAmount(val);
            if (amt !== undefined) {
              claim[targetField as keyof ParsedClaimData] = amt;
            } else {
              claim[targetField as keyof ParsedClaimData] = '0.00';
            }
          } else {
            claim[targetField as keyof ParsedClaimData] = String(val).trim();
          }
        } else {
          // Keep unmapped data in additionalData JSONB
          additionalData[hdr] = val;
        }
      }
    });

    if (Object.keys(additionalData).length > 0) {
      claim.additionalData = additionalData;
    }

    // Must have at least one identifier or amount to be a valid claim row
    const hasIdentifier = Boolean(claim.claimNumber || claim.patientName || claim.accountNumber);
    if (!hasIdentifier && !claim.billedAmount) {
      skippedRows++;
      continue;
    }

    // Ensure claimNumber is populated (auto-generate deterministic format if missing)
    if (!claim.claimNumber) {
      const datePart = claim.dateOfService ? claim.dateOfService.replace(/-/g, '') : new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const patientSlug = (claim.patientName || 'PAT')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase()
        .slice(0, 4);
      claim.claimNumber = `CLM-${datePart}-${patientSlug}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    }

    // Check duplicate claim numbers within file
    if (seenClaimNumbers.has(claim.claimNumber)) {
      duplicatesInFile++;
      // Append unique suffix so all records can be worked
      claim.claimNumber = `${claim.claimNumber}-D${duplicatesInFile}`;
    } else {
      seenClaimNumbers.add(claim.claimNumber);
    }

    // Default amounts if not specified
    if (!claim.billedAmount) claim.billedAmount = '0.00';
    if (!claim.paidAmount) claim.paidAmount = '0.00';
    if (!claim.balance) claim.balance = claim.billedAmount;

    records.push(claim);
  }

  if (duplicatesInFile > 0) {
    warnings.push(`${duplicatesInFile} duplicate claim numbers were detected in the file and given distinct identifiers.`);
  }

  if (invalidDateCount > 0) {
    warnings.push(`${invalidDateCount} records had unparseable dates and will require manual review in the work queue.`);
  }

  return {
    records,
    stats: {
      totalRows: rawRows.length - (headerRowIndex + 1),
      validRecords: records.length,
      skippedRows,
      duplicatesInFile,
    },
    warnings,
  };
}

// Backward compatibility helpers
export function parseExcelBuffer(buffer: Buffer): ParsedClaimData[] {
  const inspection = inspectWorkbook(buffer, 'upload.xlsx');
  const res = parseWorkbookWithMapping(buffer, {
    sheetName: inspection.selectedSheet,
    headerRowIndex: inspection.headerRowIndex,
    columnMapping: inspection.suggestedMapping,
  });
  return res.records;
}

export function parseCSVContent(content: string): ParsedClaimData[] {
  const buffer = Buffer.from(content, 'utf-8');
  return parseExcelBuffer(buffer);
}

export function parsePDFText(text: string): ParsedClaimData[] {
  const results: ParsedClaimData[] = [];
  const patterns = {
    claimNumber: /claim\s*(?:number|no|#)?[:\s]*([A-Z0-9-]+)/gi,
    accountNumber: /account\s*(?:number|no|#)?[:\s]*([A-Z0-9-]+)/gi,
    patientName: /patient\s*(?:name)?[:\s]*([A-Za-z\s,]+?)(?=\n|$)/gi,
    dateOfService: /(?:date\s*of\s*service|dos)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    billedAmount: /(?:billed|charges?|total)[:\s]*\$?([\d,]+\.?\d*)/gi,
    paidAmount: /(?:paid|payment)[:\s]*\$?([\d,]+\.?\d*)/gi,
    balance: /balance[:\s]*\$?([\d,]+\.?\d*)/gi,
  };

  const claim: ParsedClaimData = {};
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      claim[field as keyof ParsedClaimData] = match[1].trim();
    }
  }

  if (Object.keys(claim).length > 0) {
    if (!claim.claimNumber) {
      claim.claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    }
    if (claim.dateOfService) {
      claim.dateOfService = parseExcelDate(claim.dateOfService);
    }
    claim.billedAmount = parseAmount(claim.billedAmount) || '0.00';
    claim.paidAmount = parseAmount(claim.paidAmount) || '0.00';
    claim.balance = parseAmount(claim.balance) || claim.billedAmount;
    results.push(claim);
  }

  return results;
}
