import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

export const exportTransactionsPDF = (transactions, month = null) => {
  const doc   = new jsPDF();
  const now   = new Date();
  const label = month || now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // ── Header ──
  doc.setFontSize(22);
  doc.setTextColor(18, 40, 75);
  doc.text('Artha', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(67, 139, 196);
  doc.text('Monthly Spending Report', 14, 27);

  doc.setFontSize(10);
  doc.setTextColor(120, 130, 150);
  doc.text(label, 14, 34);

  // ── Divider ──
  doc.setDrawColor(140, 193, 233);
  doc.setLineWidth(0.3);
  doc.line(14, 38, 196, 38);

  // ── Summary boxes ──
  const expenses  = transactions.filter(t => t.transactionType === 'expense');
  const inflows   = transactions.filter(t => t.transactionType === 'inflow');
  const totalExp  = expenses.reduce((s, t) => s + t.amount, 0);
  const totalInf  = inflows.reduce((s,  t) => s + t.amount, 0);
  const net       = totalInf - totalExp;

  const boxes = [
    { label: 'Total Inflow',    value: fmt(totalInf), color: [18, 40, 75] },
    { label: 'Total Expenses',  value: fmt(totalExp), color: [220, 80,  80] },
    { label: 'Net Savings',     value: fmt(net),      color: net >= 0 ? [0, 120, 80] : [220, 80, 80] },
  ];

  boxes.forEach((box, i) => {
    const x = 14 + i * 62;
    doc.setFillColor(240, 246, 255);
    doc.roundedRect(x, 43, 58, 22, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setTextColor(100, 120, 150);
    doc.text(box.label, x + 5, 51);
    doc.setFontSize(11);
    doc.setTextColor(...box.color);
    doc.setFont('helvetica', 'bold');
    doc.text(box.value, x + 5, 60);
    doc.setFont('helvetica', 'normal');
  });

  // ── Table ──
  autoTable(doc, {
    startY: 72,
    head: [['Date', 'Name', 'Type', 'Mode', 'Category', 'Expense Type', 'Amount']],
    body: transactions.map(t => [
      new Date(t.date).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric'
      }),
      t.name,
      t.transactionType === 'inflow' ? 'Inflow' : 'Expense',
      t.paymentMode.replace(/_/g, ' '),
      t.category    || '-',
      t.expenseType || '-',
      `${t.transactionType === 'inflow' ? '+' : '-'} ${fmt(t.amount)}`,
    ]),
    headStyles: {
      fillColor:  [18, 40, 75],
      textColor:  255,
      fontSize:   8,
      fontStyle:  'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize:    8,
      textColor:   [18, 40, 75],
      cellPadding: 3,
    },
    alternateRowStyles: {
      fillColor: [245, 249, 255],
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 38 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24 },
      5: { cellWidth: 20 },
      6: { cellWidth: 32, halign: 'right' },
    },
    didParseCell: (data) => {
      // Color amount column — green for inflow, red for expense
      if (data.column.index === 6 && data.section === 'body') {
        const isInflow = String(data.cell.raw).startsWith('+');
        data.cell.styles.textColor = isInflow ? [0, 120, 80] : [200, 60, 60];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // ── Footer ──
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(160, 170, 185);
    doc.setDrawColor(200, 220, 240);
    doc.setLineWidth(0.2);
    doc.line(14, doc.internal.pageSize.height - 14, 196, doc.internal.pageSize.height - 14);
    doc.text(
      `Artha  |  Generated on ${now.toLocaleDateString('en-IN')}  |  Page ${i} of ${pageCount}`,
      14,
      doc.internal.pageSize.height - 8
    );
  }

  doc.save(`Artha-Report-${label.replace(' ', '-')}.pdf`);
};