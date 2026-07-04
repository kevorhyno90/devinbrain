// Devin BrainJet - PDF Report Generation
const PDFReport = (() => {
  function loadJsPDF() {
    return window.jspdf?.jsPDF || window.jsPDF;
  }

  function fmtDate(s) {
    if (!s) return '—';
    return new Date(s).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function fmtShortDate(s) {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function generate(plans, options = {}) {
    const jsPDF = loadJsPDF();
    if (!jsPDF) { alert('PDF library not loaded. Please reload.'); return; }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    let y = margin;

    // ===== Cover banner =====
    doc.setFillColor(255, 107, 53);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setFillColor(247, 147, 30);
    doc.rect(0, 40, pageWidth, 10, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.text('Devin BrainJet', margin, 22);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Personal Life Management Report', margin, 31);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 41);

    y = 60;

    // ===== Stats summary =====
    const total = plans.length;
    const done = plans.filter(p => p.status === 'done').length;
    const pending = plans.filter(p => p.status !== 'done').length;
    const overdue = plans.filter(p => p.status !== 'done' && p.dueDate && new Date(p.dueDate) < new Date()).length;
    const completionRate = total ? Math.round(done / total * 100) : 0;

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Executive Summary', margin, y);
    y += 6;

    doc.setDrawColor(255, 107, 53);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Stat cards
    const stats = [
      { label: 'TOTAL PLANS', value: total, color: [102, 51, 153] },
      { label: 'COMPLETED', value: done, color: [6, 214, 160] },
      { label: 'PENDING', value: pending, color: [255, 200, 87] },
      { label: 'OVERDUE', value: overdue, color: [230, 57, 70] }
    ];
    const cardWidth = (pageWidth - 2 * margin - 9) / 4;
    stats.forEach((s, i) => {
      const x = margin + i * (cardWidth + 3);
      doc.setFillColor(...s.color);
      doc.roundedRect(x, y, cardWidth, 22, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(s.label, x + cardWidth / 2, y + 7, { align: 'center' });
      doc.setFontSize(18);
      doc.text(String(s.value), x + cardWidth / 2, y + 17, { align: 'center' });
    });
    y += 28;

    // Progress bar
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Overall Completion: ${completionRate}%`, margin, y);
    y += 4;
    doc.setFillColor(230, 230, 230);
    doc.roundedRect(margin, y, pageWidth - 2 * margin, 7, 2, 2, 'F');
    doc.setFillColor(255, 107, 53);
    doc.roundedRect(margin, y, (pageWidth - 2 * margin) * (completionRate / 100), 7, 2, 2, 'F');
    y += 14;

    // ===== Category breakdown =====
    const cats = ['mind', 'farm', 'task'];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Breakdown by Category', margin, y);
    y += 6;

    const catRows = cats.map(c => {
      const items = plans.filter(p => p.category === c);
      const d = items.filter(p => p.status === 'done').length;
      return [
        c.toUpperCase(),
        String(items.length),
        String(d),
        String(items.length - d),
        items.length ? Math.round(d / items.length * 100) + '%' : '0%'
      ];
    });

    doc.autoTable({
      startY: y,
      head: [['Category', 'Total', 'Done', 'Pending', 'Rate']],
      body: catRows,
      theme: 'grid',
      headStyles: { fillColor: [255, 107, 53], textColor: 255, fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: margin, right: margin }
    });
    y = doc.lastAutoTable.finalY + 10;

    // ===== Full plans table =====
    if (y > pageHeight - 60) { doc.addPage(); y = margin; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('All Plans & Tasks', margin, y);
    y += 4;

    const rows = plans
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1;
        if (b.status === 'done' && a.status !== 'done') return -1;
        return new Date(a.dueDate || 0) - new Date(b.dueDate || 0);
      })
      .map(p => [
        (p.title || '').substring(0, 40),
        (p.category || '').toUpperCase(),
        (p.priority || 'medium').toUpperCase(),
        fmtShortDate(p.dueDate),
        p.status === 'done' ? '✓ DONE' : (p.dueDate && new Date(p.dueDate) < new Date() ? '! OVERDUE' : 'PENDING')
      ]);

    if (rows.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 120);
      doc.text('No plans yet. Start adding plans in the app!', margin, y + 10);
    } else {
      doc.autoTable({
        startY: y + 2,
        head: [['Title', 'Category', 'Priority', 'Due Date', 'Status']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: [45, 27, 78], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [255, 243, 224] },
        columnStyles: { 0: { cellWidth: 60 } },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const v = data.cell.raw;
            if (v.includes('OVERDUE')) data.cell.styles.textColor = [230, 57, 70];
            else if (v.includes('DONE')) data.cell.styles.textColor = [6, 150, 100];
          }
        }
      });
    }

    // ===== Footer on each page =====
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Devin BrainJet • Confidential • Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 7,
        { align: 'center' }
      );
    }

    // Save
    const fname = `BrainJet_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(fname);
    return fname;
  }

  return { generate };
})();
