import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Invoice, Payment, PAYMENT_METHOD_LABELS, ShopSettings } from "@/types";

function money(n: number, currency = "PKR") {
  return `${currency} ${Number(n || 0).toLocaleString("en-PK", { maximumFractionDigits: 2 })}`;
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ----------------------------------- PDF: Invoice ----------------------------------- */

export function buildInvoicePdf(invoice: Invoice, shop: ShopSettings): jsPDF {
  const docPdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = docPdf.internal.pageSize.getWidth();
  const margin = 40;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(16);
  docPdf.text(shop.shopName || "Paint Dealer", margin, 50);

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(9);
  let y = 66;
  const shopLines = [shop.address, shop.phone && `Phone: ${shop.phone}`, shop.email, shop.ntnStrn && `NTN/STRN: ${shop.ntnStrn}`].filter(
    Boolean
  ) as string[];
  shopLines.forEach((line) => {
    docPdf.text(String(line), margin, y);
    y += 12;
  });

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(14);
  docPdf.text("SALES INVOICE", pageWidth - margin, 50, { align: "right" });
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(9);
  docPdf.text(`Invoice #: ${invoice.invoiceNumber}`, pageWidth - margin, 66, { align: "right" });
  docPdf.text(`Date: ${fmtDate(invoice.createdAt)}`, pageWidth - margin, 78, { align: "right" });
  docPdf.text(
    `Status: ${invoice.status.toUpperCase()}`,
    pageWidth - margin,
    90,
    { align: "right" }
  );

  const billToY = Math.max(y, 100) + 14;
  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(10);
  docPdf.text("Bill To:", margin, billToY);
  docPdf.setFont("helvetica", "normal");
  docPdf.text(invoice.customerName || "Walk-in Customer", margin, billToY + 14);
  if (invoice.customerPhone) docPdf.text(invoice.customerPhone, margin, billToY + 27);

  const rows = invoice.items.map((it, idx) => [
    String(idx + 1),
    `${it.productName}${it.colorName ? ` (${it.colorName})` : ""}${it.shadeCode ? ` [${it.shadeCode}]` : ""}`,
    it.packing || "-",
    `${it.quantity} ${it.unit}`,
    money(it.unitPrice, shop.currency),
    `${it.discountPercent}%`,
    `${it.gstPercent}%`,
    money(it.lineTotal, shop.currency)
  ]);

  autoTable(docPdf, {
    startY: billToY + 42,
    head: [["#", "Product", "Packing", "Qty", "Unit Price", "Disc.", "GST", "Total"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [63, 78, 216] },
    margin: { left: margin, right: margin }
  });

  // @ts-ignore - lastAutoTable is added by the plugin at runtime
  let finalY = (docPdf as any).lastAutoTable.finalY + 20;

  const summaryLines: [string, string][] = [
    ["Subtotal", money(invoice.subtotal, shop.currency)],
    ["Discount", `- ${money(invoice.discountTotal, shop.currency)}`],
    ["GST", money(invoice.gstTotal, shop.currency)]
  ];
  if (invoice.whtAmount) summaryLines.push([`WHT (${invoice.whtPercent}%)`, money(invoice.whtAmount, shop.currency)]);
  summaryLines.push(["Grand Total", money(invoice.grandTotal, shop.currency)]);
  summaryLines.push(["Amount Paid", money(invoice.amountPaid, shop.currency)]);
  summaryLines.push(["Balance Due", money(invoice.balanceDue, shop.currency)]);

  const summaryX = pageWidth - margin - 200;
  docPdf.setFontSize(9);
  summaryLines.forEach(([label, value], i) => {
    const isTotal = label === "Grand Total" || label === "Balance Due";
    docPdf.setFont("helvetica", isTotal ? "bold" : "normal");
    docPdf.text(label, summaryX, finalY + i * 14);
    docPdf.text(value, pageWidth - margin, finalY + i * 14, { align: "right" });
  });

  finalY += summaryLines.length * 14 + 20;
  if (invoice.notes) {
    docPdf.setFont("helvetica", "italic");
    docPdf.setFontSize(8);
    docPdf.text(`Notes: ${invoice.notes}`, margin, finalY);
    finalY += 16;
  }

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(8);
  docPdf.setTextColor(140);
  docPdf.text("Thank you for your business.", margin, docPdf.internal.pageSize.getHeight() - 30);

  return docPdf;
}

export function downloadInvoicePdf(invoice: Invoice, shop: ShopSettings) {
  const pdf = buildInvoicePdf(invoice, shop);
  pdf.save(`${invoice.invoiceNumber}.pdf`);
}

/* ----------------------------------- PDF: Payment Receipt ----------------------------------- */

export function buildReceiptPdf(payment: Payment, shop: ShopSettings): jsPDF {
  const docPdf = new jsPDF({ unit: "pt", format: "a5" });
  const pageWidth = docPdf.internal.pageSize.getWidth();
  const margin = 32;

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(14);
  docPdf.text(shop.shopName || "Paint Dealer", margin, 40);
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(8);
  let y = 54;
  [shop.address, shop.phone && `Phone: ${shop.phone}`].filter(Boolean).forEach((line) => {
    docPdf.text(String(line), margin, y);
    y += 11;
  });

  docPdf.setFont("helvetica", "bold");
  docPdf.setFontSize(12);
  docPdf.text("PAYMENT RECEIPT", pageWidth - margin, 40, { align: "right" });
  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(8);
  docPdf.text(`Receipt #: ${payment.receiptNumber}`, pageWidth - margin, 54, { align: "right" });
  docPdf.text(`Date: ${fmtDate(payment.createdAt)}`, pageWidth - margin, 66, { align: "right" });

  const startY = Math.max(y, 80) + 20;
  const rows: [string, string][] = [
    ["Customer", payment.customerName],
    ["Invoice", payment.invoiceNumber || "—"],
    ["Payment Method", PAYMENT_METHOD_LABELS[payment.method]],
    ["Reference #", payment.referenceNumber || "—"],
    ["Previous Balance", money(payment.previousBalance, shop.currency)],
    ["Amount Received", money(payment.amount, shop.currency)],
    ["Remaining Balance", money(payment.remainingBalance, shop.currency)]
  ];

  autoTable(docPdf, {
    startY,
    body: rows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 4 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
    margin: { left: margin, right: margin }
  });

  // @ts-ignore
  let finalY = (docPdf as any).lastAutoTable.finalY + 16;
  if (payment.notes) {
    docPdf.setFont("helvetica", "italic");
    docPdf.setFontSize(8);
    docPdf.text(`Notes: ${payment.notes}`, margin, finalY);
    finalY += 14;
  }

  docPdf.setFont("helvetica", "normal");
  docPdf.setFontSize(8);
  docPdf.setTextColor(140);
  docPdf.text("This is a system-generated receipt.", margin, docPdf.internal.pageSize.getHeight() - 24);

  return docPdf;
}

export function downloadReceiptPdf(payment: Payment, shop: ShopSettings) {
  const pdf = buildReceiptPdf(payment, shop);
  pdf.save(`${payment.receiptNumber}.pdf`);
}

/* ----------------------------------- Print ----------------------------------- */

export function printInvoice(invoice: Invoice, shop: ShopSettings) {
  const pdf = buildInvoicePdf(invoice, shop);
  const blobUrl = pdf.output("bloburl");
  const win = window.open(blobUrl as unknown as string, "_blank");
  win?.addEventListener("load", () => win.print());
}

export function printReceipt(payment: Payment, shop: ShopSettings) {
  const pdf = buildReceiptPdf(payment, shop);
  const blobUrl = pdf.output("bloburl");
  const win = window.open(blobUrl as unknown as string, "_blank");
  win?.addEventListener("load", () => win.print());
}

/* ----------------------------------- Share ----------------------------------- */

export function shareInvoiceWhatsApp(invoice: Invoice, shop: ShopSettings, phone?: string) {
  const text = [
    `*${shop.shopName || "Invoice"}*`,
    `Invoice: ${invoice.invoiceNumber}`,
    `Customer: ${invoice.customerName}`,
    `Grand Total: ${money(invoice.grandTotal, shop.currency)}`,
    `Balance Due: ${money(invoice.balanceDue, shop.currency)}`,
    "",
    "Download the invoice PDF from the app and attach it here."
  ].join("\n");
  const digits = (phone || invoice.customerPhone || "").replace(/[^0-9]/g, "");
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

export function shareInvoiceEmail(invoice: Invoice, shop: ShopSettings, email?: string) {
  const subject = `Invoice ${invoice.invoiceNumber} from ${shop.shopName || "Paint Dealer"}`;
  const body = [
    `Dear ${invoice.customerName},`,
    "",
    `Please find your invoice ${invoice.invoiceNumber} summary below:`,
    `Grand Total: ${money(invoice.grandTotal, shop.currency)}`,
    `Balance Due: ${money(invoice.balanceDue, shop.currency)}`,
    "",
    "(Please attach the downloaded PDF before sending.)",
    "",
    "Regards,",
    shop.shopName || "Paint Dealer"
  ].join("\n");
  window.location.href = `mailto:${email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function shareReceiptWhatsApp(payment: Payment, shop: ShopSettings, phone?: string) {
  const text = [
    `*${shop.shopName || "Payment Receipt"}*`,
    `Receipt: ${payment.receiptNumber}`,
    `Customer: ${payment.customerName}`,
    `Amount Received: ${money(payment.amount, shop.currency)}`,
    `Remaining Balance: ${money(payment.remainingBalance, shop.currency)}`,
    "",
    "Download the receipt PDF from the app and attach it here."
  ].join("\n");
  const digits = (phone || "").replace(/[^0-9]/g, "");
  const url = `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

export function shareReceiptEmail(payment: Payment, shop: ShopSettings, email?: string) {
  const subject = `Payment Receipt ${payment.receiptNumber} from ${shop.shopName || "Paint Dealer"}`;
  const body = [
    `Dear ${payment.customerName},`,
    "",
    `We've received your payment. Receipt ${payment.receiptNumber} summary:`,
    `Amount Received: ${money(payment.amount, shop.currency)}`,
    `Remaining Balance: ${money(payment.remainingBalance, shop.currency)}`,
    "",
    "(Please attach the downloaded PDF before sending.)",
    "",
    "Regards,",
    shop.shopName || "Paint Dealer"
  ].join("\n");
  window.location.href = `mailto:${email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
