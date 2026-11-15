import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { monthLabel, dateLabel } from './utils.js';

// jsPDF's built-in font has no "৳" glyph, so PDFs use "Tk"
export const tk = (n) => 'Tk ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

const GREEN = [36, 73, 47];
const GOLD = [176, 141, 60];
const GOLD_SOFT = [247, 238, 214];

// Load the emblem so it can be printed at the top of every PDF. If it fails, the PDF still works without it.
const loadLogo = () =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve({ data: c.toDataURL('image/png'), w: img.width, h: img.height });
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = '/logo-icon.png';
  });

// Logo + title + info lines + gold divider. Returns the y position where content can start.
function drawHeader(doc, logo, title, lines) {
  const pageW = doc.internal.pageSize.getWidth();
  let off = 0;
  if (logo) {
    const h = 20;
    const w = (h * logo.w) / logo.h;
    doc.addImage(logo.data, 'PNG', 14, 9, w, h);
    off = w + 5;
  }
  doc.setFontSize(18);
  doc.setTextColor(...GREEN);
  doc.text(title, 14 + off, 18);

  doc.setFontSize(10);
  doc.setTextColor(80);
  let y = 18;
  lines.filter(Boolean).forEach((line) => {
    doc.splitTextToSize(line, pageW - 28 - off).forEach((piece) => {
      y += 5;
      doc.text(piece, 14 + off, y);
    });
  });

  y = Math.max(y, 29) + 5;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.7);
  doc.line(14, y, pageW - 14, y);
  return y + 5;
}

function addPageNumbers(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`Sadaqa Fund  |  Page ${i} of ${pages}`, pageW / 2, pageH - 8, { align: 'center' });
  }
}

export async function downloadReport(data, filename = 'sadaqa-report.pdf') {
  const logo = await loadLogo();
  const doc = new jsPDF();

  const period = /^\d{4}-\d{2}$/.test(data.period) ? monthLabel(data.period) : data.period;
  let y = drawHeader(doc, logo, 'Sadaqa Fund Report', [
    `Period: ${period}`,
    data.memberName ? `Member: ${data.memberName}` : '',
    `Generated: ${dateLabel(data.generatedAt)}`,
  ]);

  const s = data.summary;
  const summaryRows = [
    ['Total Sadaqah received', tk(s.collected)],
    ['Total donated', tk(s.donated)],
    ['Net for this period', tk(s.net)],
  ];
  if (!data.memberName) summaryRows.push(['Current fund balance', tk(s.fundBalance)]);
  autoTable(doc, {
    startY: y,
    head: [['Summary', 'Amount']],
    body: summaryRows,
    headStyles: { fillColor: GREEN },
    alternateRowStyles: { fillColor: [251, 249, 243] },
    theme: 'grid',
    styles: { fontSize: 10 },
  });
  y = doc.lastAutoTable.finalY + 10;

  const heading = (text) => {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(13);
    doc.setTextColor(...GREEN);
    doc.text(text, 14, y);
    y += 2;
  };

  if (data.members && data.members.length) {
    heading('Members');
    autoTable(doc, {
      startY: y + 2,
      head: [['Member', 'Monthly', 'Extra', 'Total (this period)']],
      body: data.members.map((m) => [`${m.name} (${m.userId})`, tk(m.monthlyTotal), tk(m.extraTotal), tk(m.total)]),
      headStyles: { fillColor: GREEN },
      styles: { fontSize: 9 },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  heading(`Sadaqah received (${data.payments.length})`);
  autoTable(doc, {
    startY: y + 2,
    head: [['Month', 'Member', 'Type', 'To admin', 'Amount']],
    body: data.payments.length
      ? data.payments.map((p) => [
          monthLabel(p.month),
          p.member ? p.member.name : '-',
          p.type === 'monthly' ? 'Monthly' : 'Extra',
          p.toAdmin ? p.toAdmin.name : '-',
          tk(p.amount),
        ])
      : [['No records', '', '', '', '']],
    headStyles: { fillColor: GREEN },
    styles: { fontSize: 9 },
  });
  y = doc.lastAutoTable.finalY + 10;

  heading(`Donations given (${data.donations.length})`);
  autoTable(doc, {
    startY: y + 2,
    head: [['Month', 'Given to', 'Address', 'Reason', 'Requested by', 'Amount']],
    body: data.donations.length
      ? data.donations.map((d) => [
          monthLabel(d.month),
          d.recipientName,
          d.recipientAddress || '-',
          d.reason || '-',
          d.requestedBy ? d.requestedBy.name : '-',
          tk(d.amount),
        ])
      : [['No records', '', '', '', '', '']],
    headStyles: { fillColor: GREEN },
    styles: { fontSize: 9 },
  });

  addPageNumbers(doc);
  doc.save(filename);
}

// A single table (whatever is on screen in History) as a PDF.
// head: ['Month', ...]   body: array of row arrays (amounts already formatted)   total: optional number
export async function downloadHistoryPdf({ title, filterText, head, body, total, extraTables = [], filename }) {
  const logo = await loadLogo();
  const doc = new jsPDF({ orientation: head.length > 5 ? 'landscape' : 'portrait' });
  const pageH = doc.internal.pageSize.getHeight();

  let startY = drawHeader(doc, logo, `Sadaqa Fund - ${title}`, [
    filterText,
    `Generated: ${dateLabel(new Date().toISOString())}   |   Records: ${body.length}`,
  ]);

  // Optional small summary tables (for example "Total by member") before the full list
  for (const t of extraTables) {
    if (startY > pageH - 50) {
      doc.addPage();
      startY = 16;
    }
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text(t.title, 14, startY + 2);
    autoTable(doc, {
      startY: startY + 5,
      head: [t.head],
      body: t.body,
      headStyles: { fillColor: GREEN },
      styles: { fontSize: 9 },
      tableWidth: 110,
    });
    startY = doc.lastAutoTable.finalY + 10;
  }
  if (extraTables.length) {
    if (startY > pageH - 40) {
      doc.addPage();
      startY = 16;
    }
    doc.setFontSize(12);
    doc.setTextColor(...GREEN);
    doc.text('All records', 14, startY + 2);
    startY += 5;
  }

  autoTable(doc, {
    startY,
    head: [head],
    body: body.length ? body : [[{ content: 'No records for these filters', colSpan: head.length }]],
    foot:
      total !== null && total !== undefined && body.length
        ? [[{ content: 'Total', colSpan: head.length - 1, styles: { halign: 'right' } }, tk(total)]]
        : undefined,
    headStyles: { fillColor: GREEN },
    footStyles: { fillColor: GOLD_SOFT, textColor: [30, 60, 40] },
    styles: { fontSize: 9 },
  });

  addPageNumbers(doc);
  doc.save(filename);
}
