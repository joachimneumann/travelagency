import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeText } from "../../../../shared/js/text.js";

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function buildMinimalPdf(lines) {
  const content = [
    "BT",
    "/F1 12 Tf",
    "50 780 Td",
    ...lines.flatMap((line, index) => (index === 0 ? [`(${escapePdfText(line)}) Tj`] : ["0 -18 Td", `(${escapePdfText(line)}) Tj`])),
    "ET"
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(content, "utf8")} >> stream\n${content}\nendstream endobj`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

export function createInvoicePdfWriter({ invoicePdfPath }) {
  return async function writeInvoicePdf(invoice, invoiceParty, booking) {
    const outputPath = invoicePdfPath(invoice.id, invoice.version || 1);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const lines = [
      normalizeText(invoice.title) || `Invoice ${invoice.invoice_number || invoice.id}`,
      `Invoice number: ${normalizeText(invoice.invoice_number) || invoice.id}`,
      `Issue date: ${normalizeText(invoice.issue_date) || "-"}`,
      `Due date: ${normalizeText(invoice.due_date) || "-"}`,
      `Customer: ${normalizeText(invoiceParty?.name) || normalizeText(booking?.client_display_name) || "Client"}`,
      `Email: ${normalizeText(invoiceParty?.email) || normalizeText(booking?.client_primary_email) || "-"}`,
      `Phone: ${normalizeText(invoiceParty?.phone_number) || normalizeText(booking?.client_primary_phone_number) || "-"}`,
      `Booking: ${normalizeText(booking?.id) || "-"}`,
      `Currency: ${normalizeText(invoice.currency) || "-"}`,
      `Total amount: ${invoice.total_amount_cents ?? 0}`,
      `Due amount: ${invoice.due_amount_cents ?? 0}`
    ];
    await writeFile(outputPath, buildMinimalPdf(lines));
  };
}
