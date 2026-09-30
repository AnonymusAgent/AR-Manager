// ERA/835 Parser — parses ANSI X12 835 format and CSV-based remittance files

export interface EraTransaction {
  claimNumber: string;
  patientName: string;
  dateOfService: string;
  cptCode: string;
  billedAmount: number;
  allowedAmount: number;
  paidAmount: number;
  contractualAdjustment: number;
  patientResponsibility: number;
  otherAdjustment: number;
  carcCode: string;
  rarcCode: string;
  remarkText: string;
}

export interface ParsedEra {
  payerName: string;
  paymentDate: string;
  checkNumber: string;
  totalPayment: number;
  transactions: EraTransaction[];
}

/**
 * Parse an 835/ERA file. Supports:
 * 1. ANSI X12 835 format (segment-delimited)
 * 2. CSV-based remittance format
 */
export function parseEraFile(content: string, fileName: string): ParsedEra {
  // Detect format
  if (content.includes('ISA*') || content.includes('ISA~') || content.includes('ST*835')) {
    return parse835(content);
  }
  // Try CSV
  if (content.includes(',') && (content.toLowerCase().includes('claim') || content.toLowerCase().includes('patient'))) {
    return parseCsvEra(content);
  }
  throw new Error('Unrecognized ERA file format. Supported: ANSI X12 835, CSV remittance.');
}

function parse835(content: string): ParsedEra {
  // Determine segment terminator
  const terminator = content.includes('~') ? '~' : '\n';
  const segments = content.split(terminator).map(s => s.trim()).filter(Boolean);

  let payerName = '', paymentDate = '', checkNumber = '', totalPayment = 0;
  const transactions: EraTransaction[] = [];
  let currentTx: Partial<EraTransaction> = {};

  for (const seg of segments) {
    const elements = seg.split('*');
    const segId = elements[0];

    if (segId === 'N1' && elements[1] === 'PR') {
      payerName = elements[2] || '';
    } else if (segId === 'BPR') {
      totalPayment = parseFloat(elements[2] || '0');
      paymentDate = formatDate(elements[16] || '');
    } else if (segId === 'TRN') {
      checkNumber = elements[2] || '';
    } else if (segId === 'CLP') {
      // Save previous transaction
      if (currentTx.claimNumber) transactions.push(fillDefaults(currentTx));
      currentTx = {
        claimNumber: elements[1] || '',
        patientName: '',
        billedAmount: parseFloat(elements[3] || '0'),
        paidAmount: parseFloat(elements[4] || '0'),
      };
    } else if (segId === 'NM1' && elements[1] === 'QC') {
      currentTx.patientName = `${elements[3] || ''} ${elements[4] || ''}`.trim();
    } else if (segId === 'DTM' && elements[1] === '232') {
      currentTx.dateOfService = formatDate(elements[2] || '');
    } else if (segId === 'SVC') {
      const codeInfo = (elements[1] || '').split(':');
      currentTx.cptCode = codeInfo[1] || codeInfo[0] || '';
      currentTx.billedAmount = parseFloat(elements[2] || '0');
      currentTx.paidAmount = parseFloat(elements[3] || '0');
    } else if (segId === 'CAS') {
      const group = elements[1] || '';
      const amount = parseFloat(elements[3] || '0');
      if (group === 'CO') currentTx.contractualAdjustment = (currentTx.contractualAdjustment || 0) + amount;
      else if (group === 'PR') currentTx.patientResponsibility = (currentTx.patientResponsibility || 0) + amount;
      else if (group === 'OA') currentTx.otherAdjustment = (currentTx.otherAdjustment || 0) + amount;
      currentTx.carcCode = elements[2] || currentTx.carcCode || '';
    } else if (segId === 'LQ') {
      if (elements[1] === 'HE') currentTx.rarcCode = elements[2] || '';
    }
  }

  // Save last transaction
  if (currentTx.claimNumber) transactions.push(fillDefaults(currentTx));

  return { payerName, paymentDate, checkNumber, totalPayment, transactions };
}

function parseCsvEra(content: string): ParsedEra {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('ERA CSV file is empty or has no data rows');

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, '_'));
  const transactions: EraTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = values[j] || ''; });

    transactions.push({
      claimNumber: row.claim_number || row.claim_ || row.claim_id || row.claimno || '',
      patientName: row.patient_name || row.patient || row.member_name || '',
      dateOfService: row.date_of_service || row.dos || row.service_date || '',
      cptCode: row.cpt_code || row.cpt || row.procedure_code || '',
      billedAmount: parseFloat(row.billed_amount || row.billed || row.charges || '0'),
      allowedAmount: parseFloat(row.allowed_amount || row.allowed || '0'),
      paidAmount: parseFloat(row.paid_amount || row.paid || row.payment || '0'),
      contractualAdjustment: parseFloat(row.contractual_adjustment || row.adjustment || '0'),
      patientResponsibility: parseFloat(row.patient_responsibility || row.patient_resp || '0'),
      otherAdjustment: parseFloat(row.other_adjustment || '0'),
      carcCode: row.carc_code || row.carc || row.denial_code || '',
      rarcCode: row.rarc_code || row.rarc || '',
      remarkText: row.remark || row.remarks || row.notes || '',
    });
  }

  const totalPayment = transactions.reduce((sum, t) => sum + t.paidAmount, 0);
  return { payerName: '', paymentDate: '', checkNumber: '', totalPayment, transactions };
}

function formatDate(d: string): string {
  if (!d || d.length < 8) return d;
  if (d.length === 8) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  return d;
}

function fillDefaults(tx: Partial<EraTransaction>): EraTransaction {
  return {
    claimNumber: tx.claimNumber || '',
    patientName: tx.patientName || '',
    dateOfService: tx.dateOfService || '',
    cptCode: tx.cptCode || '',
    billedAmount: tx.billedAmount || 0,
    allowedAmount: tx.allowedAmount || 0,
    paidAmount: tx.paidAmount || 0,
    contractualAdjustment: tx.contractualAdjustment || 0,
    patientResponsibility: tx.patientResponsibility || 0,
    otherAdjustment: tx.otherAdjustment || 0,
    carcCode: tx.carcCode || '',
    rarcCode: tx.rarcCode || '',
    remarkText: tx.remarkText || '',
  };
}
