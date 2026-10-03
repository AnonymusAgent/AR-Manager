import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { inspectWorkbook, parseWorkbookWithMapping } from '../src/lib/file-parser.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const rawUrl = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
const directUrl = rawUrl.replace('-pooler', '');
const pool = new Pool({ connectionString: directUrl, ssl: { rejectUnauthorized: false } });

async function runTests() {
  console.log('=== STARTING END-TO-END VERIFICATION ===\n');

  // Test 1: Verify Schema & Columns in Database
  console.log('Test 1: Verifying Neon DB user and claims schema...');
  const userCols = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'users';
  `);
  const userColNames = userCols.rows.map((r) => r.column_name);
  if (!userColNames.includes('phone') || !userColNames.includes('avatar_url') || !userColNames.includes('preferences')) {
    throw new Error('Missing expected columns in users table: phone, avatar_url, preferences');
  }
  console.log('✓ Users table has phone, avatar_url, preferences');

  const claimCols = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_name = 'claims';
  `);
  const claimColNames = claimCols.rows.map((r) => r.column_name);
  if (!claimColNames.includes('diagnosis_code') || !claimColNames.includes('location')) {
    throw new Error('Missing expected columns in claims table: diagnosis_code, location');
  }
  console.log('✓ Claims table has diagnosis_code, location');

  // Test 2: Create a Realistic AR Excel File with Varied Column Names
  console.log('\nTest 2: Generating synthetic Excel file with real-world variations...');
  const testData = [
    {
      'Pt Name': 'Eleanor Vance',
      'Acct #': 'AC-9801',
      'Claim ID': 'CLM-2026-TEST-001',
      'DOS': '02/15/2026',
      'CPT': '99214',
      'Diagnosis Code': 'M54.5',
      'Doctor Name': 'Dr. Robert Smith, MD',
      'Carrier': 'Blue Cross Blue Shield',
      'Payer ID': 'BCBS01',
      'Total Charges': '$350.00',
      'Ins Paid': '$220.00',
      'Balance Due': '$130.00',
      'CARC Reason': 'CO-45: Charges exceed fee schedule',
      'POS Facility': 'Main Clinic Suite 400',
      'Custom Internal Notes': 'Pending patient co-pay statement',
    },
    {
      'Pt Name': 'Arthur Pendelton',
      'Acct #': 'AC-9802',
      'Claim ID': 'CLM-2026-TEST-002',
      'DOS': '03/01/2026',
      'CPT': '99213, 93000',
      'Diagnosis Code': 'I10',
      'Doctor Name': 'Dr. Sarah Connor, DO',
      'Carrier': 'Aetna Health',
      'Payer ID': 'AETNA99',
      'Total Charges': '$520.50',
      'Ins Paid': '$0.00',
      'Balance Due': '$520.50',
      'CARC Reason': 'PR-1: Deductible amount',
      'POS Facility': 'South Pavilion',
      'Custom Internal Notes': 'Prior auth confirmed on file',
    },
    {
      'Pt Name': 'Sophia Lorenzen',
      'Acct #': 'AC-9803',
      'Claim ID': 'CLM-2026-TEST-003',
      'DOS': '2026-01-20',
      'CPT': '73721',
      'Diagnosis Code': 'M25.561',
      'Doctor Name': 'Dr. Gregory House, MD',
      'Carrier': 'UnitedHealthcare',
      'Payer ID': 'UHC01',
      'Total Charges': '1,200.00',
      'Ins Paid': '850.00',
      'Balance Due': '350.00',
      'CARC Reason': 'CO-97: Bundled service',
      'POS Facility': 'Radiology Center',
      'Custom Internal Notes': 'Appealed on 02/01',
    },
  ];

  const ws = XLSX.utils.json_to_sheet(testData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aging Report');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  console.log(`✓ Generated synthetic Excel buffer (${buffer.length} bytes) with 3 records`);

  // Test 3: Test Workbook Inspection & Fuzzy Matching
  console.log('\nTest 3: Testing inspectWorkbook and fuzzy matching...');
  const inspection = inspectWorkbook(buffer, 'test_ar_aging.xlsx');
  console.log(`✓ Sheets detected: ${inspection.sheets.join(', ')}`);
  console.log(`✓ Total data rows: ${inspection.totalDataRows}`);
  console.log('✓ Suggested Mappings:');
  for (const [header, mapped] of Object.entries(inspection.suggestedMapping)) {
    console.log(`   "${header}" -> ${mapped}`);
  }

  if (inspection.suggestedMapping['Pt Name'] !== 'patientName') {
    throw new Error('Failed to map "Pt Name" to "patientName"');
  }
  if (inspection.suggestedMapping['Claim ID'] !== 'claimNumber') {
    throw new Error('Failed to map "Claim ID" to "claimNumber"');
  }
  if (inspection.suggestedMapping['DOS'] !== 'dateOfService') {
    throw new Error('Failed to map "DOS" to "dateOfService"');
  }
  if (inspection.suggestedMapping['Total Charges'] !== 'billedAmount') {
    throw new Error('Failed to map "Total Charges" to "billedAmount"');
  }
  if (inspection.suggestedMapping['Balance Due'] !== 'balance') {
    throw new Error('Failed to map "Balance Due" to "balance"');
  }
  if (inspection.suggestedMapping['Carrier'] !== 'insurance') {
    throw new Error('Failed to map "Carrier" to "insurance"');
  }
  console.log('✓ All standard variations successfully mapped!');

  // Test 4: Test parseWorkbookWithMapping
  console.log('\nTest 4: Testing parseWorkbookWithMapping with verified column mappings...');
  const parseResult = parseWorkbookWithMapping(buffer, {
    sheetName: inspection.selectedSheet,
    headerRowIndex: inspection.headerRowIndex,
    columnMapping: inspection.suggestedMapping,
  });

  console.log(`✓ Parsed ${parseResult.records.length} claim records`);
  const firstClaim = parseResult.records[0];
  console.log('Sample parsed record:', {
    claimNumber: firstClaim.claimNumber,
    patientName: firstClaim.patientName,
    dateOfService: firstClaim.dateOfService,
    billedAmount: firstClaim.billedAmount,
    paidAmount: firstClaim.paidAmount,
    balance: firstClaim.balance,
    insurance: firstClaim.insurance,
    additionalData: firstClaim.additionalData,
  });

  if (firstClaim.claimNumber !== 'CLM-2026-TEST-001') throw new Error('Claim number mismatch');
  if (firstClaim.patientName !== 'Eleanor Vance') throw new Error('Patient name mismatch');
  if (firstClaim.dateOfService !== '2026-02-15') throw new Error(`Date of service mismatch: got ${firstClaim.dateOfService}`);
  if (firstClaim.billedAmount !== '350.00') throw new Error('Billed amount mismatch');
  if (firstClaim.paidAmount !== '220.00') throw new Error('Paid amount mismatch');
  if (firstClaim.balance !== '130.00') throw new Error('Balance mismatch');
  if (!firstClaim.additionalData || !firstClaim.additionalData['Custom Internal Notes']) {
    throw new Error('Extra columns were not preserved in additionalData');
  }
  console.log('✓ Ingestion parsing, date formatting, and additionalData preservation verified!');

  console.log('\n=== ALL END-TO-END TESTS PASSED SUCCESSFULLY! ===');
  await pool.end();
}

runTests().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
