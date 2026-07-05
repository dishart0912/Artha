import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmt = (amount) => `Rs. ${Number(amount).toLocaleString('en-IN')}`;

export const exportTransactionsPDF = (transactions, filterCategory = 'all', month = null) => {
  const doc   = new jsPDF();
  const now   = new Date();

  // Detect month from transactions if they all belong to the same month and year
  let detectedMonth = null;
  if (transactions && transactions.length > 0) {
    const dates = transactions.map(t => new Date(t.date));
    const firstDate = dates[0];
    const sameMonth = dates.every(d => d.getMonth() === firstDate.getMonth() && d.getFullYear() === firstDate.getFullYear());
    if (sameMonth) {
      detectedMonth = firstDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }
  }
  const monthLabel = month || detectedMonth || now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const categoryLabel = filterCategory === 'all' ? 'All Categories' : filterCategory;

  // ── Header ──
  doc.setFontSize(22);
  doc.setTextColor(18, 40, 75);
  doc.text('Artha', 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(67, 139, 196);
  const subtitle = filterCategory !== 'all' ? `Category Report: ${filterCategory}` : 'Monthly Spending Report';
  doc.text(subtitle, 14, 27);

  // ── Divider ──
  doc.setDrawColor(140, 193, 233);
  doc.setLineWidth(0.3);
  doc.line(14, 33, 196, 33);

  // ── Summary Details (replacing the three cards) ──
  const total = transactions.reduce((sum, t) => {
    if (t.transactionType === 'inflow') return sum + t.amount;
    return sum - t.amount;
  }, 0);

  // Draw elegant background rectangle for metadata
  doc.setFillColor(240, 246, 255);
  doc.roundedRect(14, 38, 182, 22, 3, 3, 'F');

  // Metadata labels
  doc.setFontSize(8);
  doc.setTextColor(100, 120, 150);
  doc.setFont('helvetica', 'normal');
  doc.text('Month', 19, 46);
  doc.text('Date Generated', 64.5, 46);
  doc.text('Category Selected', 110, 46);
  doc.text('Total Net Amount', 155.5, 46);

  // Metadata values
  doc.setFontSize(10);
  doc.setTextColor(18, 40, 75);
  doc.setFont('helvetica', 'bold');
  
  // 1. Month value
  doc.text(monthLabel, 19, 54);

  // 2. Date value
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  doc.text(dateStr, 64.5, 54);

  // 3. Category value (truncate if too long)
  const displayCategory = categoryLabel.length > 18 ? categoryLabel.substring(0, 15) + '...' : categoryLabel;
  doc.text(displayCategory, 110, 54);

  // 4. Total Amount value
  const totalVal = (total >= 0 ? '+' : '-') + ' ' + fmt(Math.abs(total));
  const totalColor = total >= 0 ? [0, 120, 80] : [220, 80, 80];
  doc.setTextColor(...totalColor);
  doc.text(totalVal, 155.5, 54);

  // Reset text settings
  doc.setFont('helvetica', 'normal');

  // ── Table ──
  autoTable(doc, {
    startY: 68,
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

  doc.save(`Artha-Report-${categoryLabel.replace(/\s+/g, '-')}-${monthLabel.replace(/\s+/g, '-')}.pdf`);
};