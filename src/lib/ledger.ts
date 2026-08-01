import { collection, doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Invoice, InvoiceLineItem, Payment, PaymentMethod } from "@/types";
import { formatSequence, nextSequence } from "@/lib/numbering";

export interface NewInvoiceInput {
  customerId: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceLineItem[];
  subtotal: number;
  discountTotal: number;
  gstTotal: number;
  whtPercent: number;
  whtAmount: number;
  grandTotal: number;
  notes: string;
  createdBy: string;
  invoicePrefix: string;
}

/**
 * Creates an invoice, its ledger (debit) entry, and updates the customer's running outstanding
 * balance — all inside one Firestore transaction so the three can never drift out of sync
 * (e.g. an invoice existing without its ledger entry, or an outstanding balance that doesn't
 * match the sum of ledger entries).
 */
export async function createInvoiceWithLedger(input: NewInvoiceInput): Promise<{ id: string; invoiceNumber: string }> {
  const seq = await nextSequence("invoices");
  const invoiceNumber = formatSequence(input.invoicePrefix || "INV-", seq);

  const invoiceRef = doc(collection(db, "invoices"));
  const ledgerRef = doc(collection(db, "ledgerEntries"));
  const customerRef = doc(db, "customers", input.customerId);

  await runTransaction(db, async (tx) => {
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists()) throw new Error("Customer no longer exists.");
    const previousOutstanding = (customerSnap.data().outstanding as number) ?? 0;
    const newOutstanding = previousOutstanding + input.grandTotal;

    const invoiceData: Omit<Invoice, "id"> = {
      invoiceNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      items: input.items,
      subtotal: input.subtotal,
      discountTotal: input.discountTotal,
      gstTotal: input.gstTotal,
      whtPercent: input.whtPercent,
      whtAmount: input.whtAmount,
      grandTotal: input.grandTotal,
      amountPaid: 0,
      balanceDue: input.grandTotal,
      status: "unpaid",
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: 0,
      updatedAt: 0
    };

    tx.set(invoiceRef, { ...invoiceData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });

    tx.set(ledgerRef, {
      customerId: input.customerId,
      type: "invoice",
      refId: invoiceRef.id,
      refNumber: invoiceNumber,
      description: `Invoice ${invoiceNumber} (${input.items.length} item${input.items.length === 1 ? "" : "s"})`,
      debit: input.grandTotal,
      credit: 0,
      balance: newOutstanding,
      createdAt: serverTimestamp()
    });

    tx.update(customerRef, { outstanding: newOutstanding, updatedAt: serverTimestamp() });
  });

  return { id: invoiceRef.id, invoiceNumber };
}

export interface NewPaymentInput {
  customerId: string;
  customerName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amount: number;
  method: PaymentMethod;
  referenceNumber: string;
  notes: string;
  createdBy: string;
  receiptPrefix?: string;
}

/**
 * Records a payment, its ledger (credit) entry, decrements the customer's outstanding balance,
 * and — if the payment is tied to a specific invoice — updates that invoice's amountPaid /
 * balanceDue / status. All in one transaction for the same consistency reason as above.
 */
export async function recordPaymentWithLedger(
  input: NewPaymentInput
): Promise<{ id: string; receiptNumber: string; remainingBalance: number }> {
  const seq = await nextSequence("payments");
  const receiptNumber = formatSequence(input.receiptPrefix || "RCPT-", seq);

  const paymentRef = doc(collection(db, "payments"));
  const ledgerRef = doc(collection(db, "ledgerEntries"));
  const customerRef = doc(db, "customers", input.customerId);
  const invoiceRef = input.invoiceId ? doc(db, "invoices", input.invoiceId) : null;

  const result = await runTransaction(db, async (tx) => {
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists()) throw new Error("Customer no longer exists.");
    const previousBalance = (customerSnap.data().outstanding as number) ?? 0;
    const remainingBalance = previousBalance - input.amount;

    let invoiceSnap = null;
    if (invoiceRef) {
      invoiceSnap = await tx.get(invoiceRef);
    }

    const paymentData: Omit<Payment, "id"> = {
      receiptNumber,
      customerId: input.customerId,
      customerName: input.customerName,
      invoiceId: input.invoiceId,
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      previousBalance,
      remainingBalance,
      method: input.method,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      createdBy: input.createdBy,
      createdAt: 0
    };

    tx.set(paymentRef, { ...paymentData, createdAt: serverTimestamp() });

    tx.set(ledgerRef, {
      customerId: input.customerId,
      type: "payment",
      refId: paymentRef.id,
      refNumber: receiptNumber,
      description: input.invoiceNumber
        ? `Payment received — Receipt ${receiptNumber} (against ${input.invoiceNumber})`
        : `Payment received — Receipt ${receiptNumber}`,
      debit: 0,
      credit: input.amount,
      balance: remainingBalance,
      createdAt: serverTimestamp()
    });

    tx.update(customerRef, { outstanding: remainingBalance, updatedAt: serverTimestamp() });

    if (invoiceRef && invoiceSnap?.exists()) {
      const invData = invoiceSnap.data();
      const newAmountPaid = (invData.amountPaid ?? 0) + input.amount;
      const newBalanceDue = Math.max((invData.grandTotal ?? 0) - newAmountPaid, 0);
      const status = newBalanceDue <= 0 ? "paid" : newAmountPaid > 0 ? "partial" : "unpaid";
      tx.update(invoiceRef, {
        amountPaid: newAmountPaid,
        balanceDue: newBalanceDue,
        status,
        updatedAt: serverTimestamp()
      });
    }

    return { remainingBalance };
  });

  return { id: paymentRef.id, receiptNumber, remainingBalance: result.remainingBalance };
}
