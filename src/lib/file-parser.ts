import * as XLSX from 'xlsx';

export interface ParsedClaimData {
  claimNumber?: string;
  accountNumber?: string;
  patientName?: string;
  dateOfService?: string;
  cptCodes?: string;
  provider?: string;
  insurance?: string;
  payer?: string;
  billedAmount?: string;
  paidAmount?: string;
  balance?: string;
  status?: string;
  additionalData?: Record<string, unknown>;
  [key: string]: string | Record<string, unknown> | undefined;
}

// Column mapping patterns for intelligent field detection
const COLUMN_MAPPINGS: Record<string, string[]> = {
  claimNumber: ['claim number', 'claim no', 'claim #', 'claim_number', 'claimno', 'claim id', 'claimid'],
  accountNumber: ['account number', 'account no', 'account #', 'account_number', 'acct no', 'acct number', 'patient account'],
  patientName: ['patient name', 'patient', 'name', 'patient_name', 'member name', 'subscriber name'],
  dateOfService: ['date of service', 'dos', 'service date', 'date_of_service', 'from date', 'svc date'],
  cptCodes: ['cpt', 'cpt code', 'cpt codes', 'procedure code', 'proc code', 'hcpcs', 'procedure'],
  provider: ['provider', 'provider name', 'rendering provider', 'physician', 'doctor', 'npi'],
  insurance: ['insurance', 'insurance name', 'ins name', 'carrier', 'insurance company'],
  payer: ['payer', 'payer name', 'payor', 'payor name'],
  billedAmount: ['billed amount', 'billed', 'charge', 'charges', 'total charges', 'amount billed', 'billed_amount'],
  paidAmount: ['paid amount', 'paid', 'payment', 'amount paid', 'paid_amount', 'reimbursement'],
  balance: ['balance', 'balance due', 'amount due', 'outstanding', 'remaining'],
  status: ['status', 'claim status', 'state'],
};

function normalizeColumnName(col: string): string {
  return col.toLowerCase().replace(/[_\-\s]+/g, ' ').trim();
}

function findFieldMapping(columnName: string): string | null {
  const normalized = normalizeColumnName(columnName);
  
  for (const [field, patterns] of Object.entries(COLUMN_MAPPINGS)) {
    if (patterns.some(pattern => normalized.includes(pattern) || pattern.includes(normalized))) {
      return field;
    }
  }
  
  return null;
}

function parseExcelDate(value: unknown): string | undefined {
  if (!value) return undefined;
  
  if (typeof value === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  
  if (typeof value === 'string') {
    // Try to parse various date formats
    const dateStr = value.trim();
    const formats = [
      /^(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
    ];
    
    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format.source.startsWith('^(\\d{4})')) {
          return `${match[1]}-${match[2]}-${match[3]}`;
        } else {
          return `${match[3]}-${match[1]}-${match[2]}`;
        }
      }
    }
    
    return dateStr;
  }
  
  return String(value);
}

function parseAmount(value: unknown): string | undefined {
  if (!value) return undefined;
  
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  
  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num.toFixed(2);
  }
  
  return undefined;
}

export function parseExcelBuffer(buffer: Buffer): ParsedClaimData[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const results: ParsedClaimData[] = [];
  
  // Process first sheet
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with headers
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][];
  
  if (data.length < 2) {
    return results;
  }
  
  // First row is headers
  const headers = data[0] as string[];
  const columnMap: Record<number, string> = {};
  const unmappedColumns: Record<number, string> = {};
  
  // Map columns to fields
  headers.forEach((header, index) => {
    if (header) {
      const field = findFieldMapping(String(header));
      if (field) {
        columnMap[index] = field;
      } else {
        unmappedColumns[index] = String(header);
      }
    }
  });
  
  // Process data rows
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[];
    if (!row || row.length === 0) continue;
    
    const claim: ParsedClaimData = {};
    const additionalData: Record<string, unknown> = {};
    
    // Map known columns
    for (const [indexStr, field] of Object.entries(columnMap)) {
      const index = parseInt(indexStr);
      const value = row[index];
      
      if (value !== undefined && value !== null && value !== '') {
        if (field === 'dateOfService') {
          claim[field] = parseExcelDate(value);
        } else if (['billedAmount', 'paidAmount', 'balance'].includes(field)) {
          claim[field as keyof ParsedClaimData] = parseAmount(value);
        } else {
          claim[field as keyof ParsedClaimData] = String(value);
        }
      }
    }
    
    // Map unmapped columns to additionalData
    for (const [indexStr, header] of Object.entries(unmappedColumns)) {
      const index = parseInt(indexStr);
      const value = row[index];
      if (value !== undefined && value !== null && value !== '') {
        additionalData[header] = value;
      }
    }
    
    if (Object.keys(additionalData).length > 0) {
      claim.additionalData = additionalData;
    }
    
    // Only add if we have at least a claim number or some identifiable data
    if (claim.claimNumber || claim.accountNumber || claim.patientName) {
      results.push(claim);
    }
  }
  
  return results;
}

export function parseCSVContent(content: string): ParsedClaimData[] {
  const results: ParsedClaimData[] = [];
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  
  if (lines.length < 2) {
    return results;
  }
  
  // Parse headers
  const headers = parseCSVLine(lines[0]);
  const columnMap: Record<number, string> = {};
  const unmappedColumns: Record<number, string> = {};
  
  headers.forEach((header, index) => {
    if (header) {
      const field = findFieldMapping(header);
      if (field) {
        columnMap[index] = field;
      } else {
        unmappedColumns[index] = header;
      }
    }
  });
  
  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    
    const claim: ParsedClaimData = {};
    const additionalData: Record<string, unknown> = {};
    
    for (const [indexStr, field] of Object.entries(columnMap)) {
      const index = parseInt(indexStr);
      const value = values[index];
      
      if (value !== undefined && value !== '') {
        if (field === 'dateOfService') {
          claim[field] = parseExcelDate(value);
        } else if (['billedAmount', 'paidAmount', 'balance'].includes(field)) {
          claim[field as keyof ParsedClaimData] = parseAmount(value);
        } else {
          claim[field as keyof ParsedClaimData] = value;
        }
      }
    }
    
    for (const [indexStr, header] of Object.entries(unmappedColumns)) {
      const index = parseInt(indexStr);
      const value = values[index];
      if (value !== undefined && value !== '') {
        additionalData[header] = value;
      }
    }
    
    if (Object.keys(additionalData).length > 0) {
      claim.additionalData = additionalData;
    }
    
    if (claim.claimNumber || claim.accountNumber || claim.patientName) {
      results.push(claim);
    }
  }
  
  return results;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

// PDF parsing extracts text and attempts to find claim information
export function parsePDFText(text: string): ParsedClaimData[] {
  const results: ParsedClaimData[] = [];
  
  // Common patterns in medical billing PDFs
  const patterns = {
    claimNumber: /claim\s*(?:number|no|#)?[:\s]*([A-Z0-9-]+)/gi,
    accountNumber: /account\s*(?:number|no|#)?[:\s]*([A-Z0-9-]+)/gi,
    patientName: /patient\s*(?:name)?[:\s]*([A-Za-z\s,]+?)(?=\n|$)/gi,
    dateOfService: /(?:date\s*of\s*service|dos)[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi,
    billedAmount: /(?:billed|charges?|total)[:\s]*\$?([\d,]+\.?\d*)/gi,
    paidAmount: /(?:paid|payment)[:\s]*\$?([\d,]+\.?\d*)/gi,
    balance: /balance[:\s]*\$?([\d,]+\.?\d*)/gi,
  };
  
  // Extract first match of each pattern
  const claim: ParsedClaimData = {};
  
  for (const [field, pattern] of Object.entries(patterns)) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      claim[field as keyof ParsedClaimData] = match[1].trim();
    }
  }
  
  if (Object.keys(claim).length > 0) {
    results.push(claim);
  }
  
  return results;
}
