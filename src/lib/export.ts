/**
 * Server-side export utilities for reports.
 * Used only by API route handlers — never import in client components.
 */

import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export interface ExportColumn {
  header: string;
  key:    string;
  width?: number;
}

/**
 * Generate an XLSX buffer from tabular data.
 */
export async function generateExcel(
  sheetName: string,
  columns:   ExportColumn[],
  rows:      Record<string, unknown>[],
): Promise<Buffer> {
  const workbook  = new ExcelJS.Workbook();
  workbook.creator = "FadilJaya.NET";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({
    header: c.header,
    key:    c.key,
    width:  c.width ?? 20,
  }));

  // Style header row
  sheet.getRow(1).font      = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // Alternating row color
  for (let i = 2; i <= rows.length + 1; i++) {
    if (i % 2 === 0) {
      sheet.getRow(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

/**
 * Generate a PDF buffer from tabular data.
 */
export function generatePDF(
  title:   string,
  columns: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows:    any[][],
): Buffer {
  const doc = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait" });

  // Title
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 16);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `FadilJaya.NET  ·  Digenerate: ${new Date().toLocaleString("id-ID")}`,
    14,
    22,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  autoTable(doc, {
    startY:        28,
    head:          [columns],
    body:          rows,
    styles:        { fontSize: 8, cellPadding: 3 },
    headStyles:    { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin:        { left: 14, right: 14 },
  });

  return Buffer.from(doc.output("arraybuffer"));
}
