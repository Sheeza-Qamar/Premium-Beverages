import { BRAND } from "@/lib/brand";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type InvoicePdfClient = {
  name: string;
  email: string | null;
  contactNumber: string | null;
};

export type InvoicePdfItem = {
  productName: string;
  bottleType: "mix" | "pure" | null;
  bottleSize?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type InvoicePdfRecord = {
  invoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  paymentType: string;
  notes: string | null;
  client: InvoicePdfClient;
  items: InvoicePdfItem[];
};

function formatPkDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(parsed);
}

async function loadImageAsDataUrl(path: string): Promise<string | null> {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const imageBlob = await response.blob();
    const blobUrl = URL.createObjectURL(imageBlob);
    const image = new Image();
    image.decoding = "async";
    image.src = blobUrl;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = 420;
    canvas.height = 420;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(blobUrl);
      return null;
    }
    const size = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
    const sx = ((image.naturalWidth || image.width) - size) / 2;
    const sy = ((image.naturalHeight || image.height) - size) / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    return canvas.toDataURL("image/png", 0.92);
  } catch {
    return null;
  }
}

export async function downloadInvoicePdf(invoice: InvoicePdfRecord): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const left = 42;
  const right = pageWidth - 42;

  doc.setDrawColor(228, 231, 236);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(30, 24, pageWidth - 60, 112, 12, 12, "FD");

  const logoDataUrl =
    (await loadImageAsDataUrl("/images/logo/elegant-premium-beverages-logo.png")) ??
    (await loadImageAsDataUrl("/images/logo/logo.svg"));
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", left + 4, 34, 72, 72);
  } else {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(BRAND.name, left, 62);
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SALES INVOICE", right, 54, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Invoice #: ${invoice.invoiceNumber}`, right, 74, { align: "right" });
  doc.text(`Issued: ${formatPkDateTime(invoice.invoiceDate)}`, right, 89, { align: "right" });
  doc.text(`Payment Type: ${invoice.paymentType.toUpperCase()}`, right, 104, {
    align: "right",
  });

  doc.setDrawColor(228, 231, 236);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(left, 152, pageWidth - 84, 70, 8, 8, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Bill To", left + 12, 172);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Client: ${invoice.client.name}`, left + 12, 190);
  doc.text(
    `Contact: ${invoice.client.email ?? invoice.client.contactNumber ?? "N/A"}`,
    left + 12,
    206,
  );

  const tableBody = invoice.items.map((item, index) => [
    String(index + 1),
    `${item.productName}${item.bottleSize ? ` · ${item.bottleSize}` : ""}${item.bottleType ? ` (${item.bottleType})` : ""}`,
    item.quantity.toFixed(2),
    item.unitPrice.toFixed(2),
    item.totalPrice.toFixed(2),
  ]);

  autoTable(doc, {
    startY: 242,
    head: [["#", "Item", "Qty", "Unit Price", "Line Total"]],
    body: tableBody,
    styles: { fontSize: 10, cellPadding: 7, textColor: [31, 41, 55] },
    headStyles: { fillColor: [26, 122, 155], textColor: [255, 255, 255], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    bodyStyles: { lineColor: [226, 232, 240], lineWidth: 0.4 },
    theme: "striped",
    margin: { left, right: left },
  });

  const tableEndY =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 380;
  const summaryBoxY = tableEndY + 16;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(right - 230, summaryBoxY, 230, 52, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Grand Total", right - 214, summaryBoxY + 21);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(invoice.totalAmount.toFixed(2), right - 16, summaryBoxY + 34, { align: "right" });

  if (invoice.notes) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(`Notes: ${invoice.notes}`, left, summaryBoxY + 76);
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(left, 760, right, 760);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Thank you for your business.", left, 778);
  doc.text("This is a computer-generated invoice.", right, 778, { align: "right" });

  doc.save(`${invoice.invoiceNumber}.pdf`);
}

export type PaymentReceiptInput = {
  receiptNumber: string;
  createdAt: string;
  paymentDate: string;
  clientName: string;
  invoiceNumber: string | null;
  paymentMethod: string;
  referenceNote: string | null;
  amountPaid: number;
  /** When payment is tied to an order / invoice */
  orderTotalAmount?: number | null;
  paidPriorToThisReceipt?: number;
  outstandingAfterThisReceipt?: number | null;
  /** Earlier payments on the same invoice (before this receipt), oldest first */
  priorPaymentsOnOrder?: Array<{
    receiptNumber: string;
    paymentDate: string;
    amountPaid: number;
  }>;
};

/** Build receipt PDF payload including prior payment lines for the same order. */
export type PaymentReceiptSourceRow = {
  id: number;
  orderId: number | null;
  receiptNumber: string;
  createdAt: string;
  paymentDate: string;
  clientName: string;
  invoiceNumber: string | null;
  paymentMethod: string;
  referenceNote: string | null;
  amountPaid: number;
  orderTotalAmount?: number | null;
  paidPriorToThisReceipt?: number;
  outstandingAfterThisReceipt?: number | null;
};

export function toPaymentReceiptInput(
  payment: PaymentReceiptSourceRow,
  allPayments: Pick<PaymentReceiptSourceRow, "id" | "orderId" | "receiptNumber" | "paymentDate" | "amountPaid">[],
): PaymentReceiptInput {
  const prior =
    payment.orderId == null
      ? []
      : [...allPayments]
          .filter((p) => p.orderId === payment.orderId && p.id < payment.id)
          .sort((a, b) => a.id - b.id)
          .map((p) => ({
            receiptNumber: p.receiptNumber,
            paymentDate: p.paymentDate,
            amountPaid: p.amountPaid,
          }));

  return {
    receiptNumber: payment.receiptNumber,
    createdAt: payment.createdAt,
    paymentDate: payment.paymentDate,
    clientName: payment.clientName,
    invoiceNumber: payment.invoiceNumber,
    paymentMethod: payment.paymentMethod,
    referenceNote: payment.referenceNote,
    amountPaid: payment.amountPaid,
    orderTotalAmount: payment.orderTotalAmount ?? null,
    paidPriorToThisReceipt: payment.paidPriorToThisReceipt ?? 0,
    outstandingAfterThisReceipt: payment.outstandingAfterThisReceipt ?? null,
    priorPaymentsOnOrder: prior,
  };
}

type JsPdfWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

export async function downloadPaymentReceiptPdf(payment: PaymentReceiptInput): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 42;
  const right = pageWidth - 42;

  doc.setDrawColor(228, 231, 236);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(30, 24, pageWidth - 60, 112, 12, 12, "FD");

  const logoDataUrl =
    (await loadImageAsDataUrl("/images/logo/elegant-premium-beverages-logo.png")) ??
    (await loadImageAsDataUrl("/images/logo/logo.svg"));
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", left + 4, 34, 72, 72);
  } else {
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(BRAND.name, left, 62);
  }

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("PAYMENT RECEIPT", right, 54, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Receipt #: ${payment.receiptNumber}`, right, 74, { align: "right" });
  doc.text(`Issued: ${formatPkDateTime(payment.createdAt)}`, right, 89, { align: "right" });
  doc.text(`Payment Date: ${payment.paymentDate}`, right, 104, { align: "right" });

  let y = 152;
  doc.setDrawColor(228, 231, 236);

  y = 172;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("Received From", left + 12, y);
  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Client: ${payment.clientName}`, left + 12, y);
  y += 17;
  doc.text(`Invoice: ${payment.invoiceNumber ?? "N/A"}`, left + 12, y);
  y += 17;
  doc.text(`Payment Method: ${payment.paymentMethod}`, left + 12, y);
  y += 17;
  doc.text(`Reference: ${payment.referenceNote ?? "N/A"}`, left + 12, y);
  y += 22;

  const hasBreakdown =
    payment.orderTotalAmount != null &&
    Number.isFinite(payment.orderTotalAmount) &&
    payment.orderTotalAmount > 0;

  if (hasBreakdown) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Invoice summary (with this receipt)", left + 12, y);
    y += 17;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(51, 65, 85);
    const priorPaid = payment.paidPriorToThisReceipt ?? 0;
    const pendingAfter =
      payment.outstandingAfterThisReceipt ??
      Math.max(payment.orderTotalAmount! - priorPaid - payment.amountPaid, 0);
    doc.text(`Order / invoice total: ${payment.orderTotalAmount!.toFixed(2)}`, left + 12, y);
    y += 16;
    doc.text(`Paid before this receipt: ${priorPaid.toFixed(2)}`, left + 12, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text(`This receipt: ${payment.amountPaid.toFixed(2)}`, left + 12, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.text(`Pending balance after this receipt: ${pendingAfter.toFixed(2)}`, left + 12, y);
    y += 22;
  }

  const priorRows = payment.priorPaymentsOnOrder ?? [];
  if (priorRows.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("Earlier payments on this invoice", left + 12, y);
    y += 12;
    autoTable(doc, {
      startY: y,
      head: [["Date", "Receipt #", "Amount"]],
      body: priorRows.map((r) => [r.paymentDate, r.receiptNumber, r.amountPaid.toFixed(2)]),
      styles: { fontSize: 9.5, cellPadding: 6, textColor: [31, 41, 55] },
      headStyles: { fillColor: [26, 122, 155], textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      bodyStyles: { lineColor: [226, 232, 240], lineWidth: 0.35 },
      theme: "striped",
      margin: { left, right: left },
    });
    y = (doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? y;
    y += 18;
  }

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(right - 230, y, 230, 52, 8, 8, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Amount received (this receipt)", right - 214, y + 21);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(payment.amountPaid.toFixed(2), right - 16, y + 34, { align: "right" });

  const footerY = Math.min(Math.max(y + 72, pageHeight - 48), pageHeight - 28);
  doc.setDrawColor(226, 232, 240);
  doc.line(left, footerY, right, footerY);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text("This is a system-generated receipt and can be used as payment proof.", left, footerY + 18);
  doc.text("Thank you for your prompt payment.", right, footerY + 18, { align: "right" });

  doc.save(`${payment.receiptNumber}.pdf`);
}
