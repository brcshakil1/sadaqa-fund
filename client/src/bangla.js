// jsPDF's built-in fonts cannot draw Bangla (and cannot join Bangla letters correctly).
// The browser can, so Bangla text is drawn on a canvas with the browser's own font and
// placed into the PDF as a small picture. Latin text stays normal, selectable PDF text.

export const hasBangla = (s) => /[\u0980-\u09FF]/.test(String(s === null || s === undefined ? '' : s));

// "Noto Sans Bengali" is loaded from Google Fonts in index.html. Windows, Android and Mac
// also have their own Bangla fonts, which are used if Google Fonts cannot be reached.
export const BANGLA_FONT = '"Noto Sans Bengali","Nirmala UI","Vrinda","Shonar Bangla","Kohinoor Bangla","Bangla Sangam MN",sans-serif';

const PX_PER_MM = 12; // drawing sharpness: about 300 dpi
const PT_TO_MM = 0.3528;

// Wait for the Bangla web font so the first PDF is not drawn in a fallback font.
export async function loadBanglaFont() {
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.all([
        document.fonts.load('400 16px "Noto Sans Bengali"', 'অআকখ'),
        document.fonts.load('600 16px "Noto Sans Bengali"', 'অআকখ'),
      ]);
    }
  } catch {
    /* fall back to the system font */
  }
}

const cssColor = (c) => {
  if (Array.isArray(c) && c.length >= 3) return `rgb(${c[0]},${c[1]},${c[2]})`;
  if (typeof c === 'number') return `rgb(${c},${c},${c})`;
  return '#141414';
};

// Draw text (wrapped to widthMm) on a transparent canvas.
// Returns { dataUrl, wMm, hMm } - the picture's natural size in millimetres.
export function banglaImage(text, { widthMm, fontPt = 9, color, bold = false }) {
  const fontPx = Math.max(8, Math.round(fontPt * PT_TO_MM * PX_PER_MM));
  const lineH = Math.round(fontPx * 1.45);
  const font = `${bold ? 600 : 400} ${fontPx}px ${BANGLA_FONT}`;
  const maxW = Math.max(20, widthMm * PX_PER_MM);

  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;

  const lines = [];
  String(text)
    .split(/\r?\n/)
    .forEach((para) => {
      let cur = '';
      para
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
          const attempt = cur ? `${cur} ${word}` : word;
          if (!cur || measure.measureText(attempt).width <= maxW) {
            cur = attempt;
          } else {
            lines.push(cur);
            cur = word;
          }
        });
      lines.push(cur);
    });

  const widest = Math.max(...lines.map((l) => measure.measureText(l).width), 1);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widest) + 4;
  canvas.height = lines.length * lineH + 4;
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.fillStyle = cssColor(color);
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 2, 2 + i * lineH + lineH / 2));

  return { dataUrl: canvas.toDataURL('image/png'), wMm: canvas.width / PX_PER_MM, hMm: canvas.height / PX_PER_MM };
}

// Hooks for jspdf-autotable. Any cell that contains Bangla is measured with a same-length
// placeholder (so the row gets the right height), left blank by the table, and then drawn
// as a picture on top. Create one set per table.
export function banglaTableHooks() {
  const stash = new WeakMap();
  return {
    didParseCell(d) {
      const raw = d.cell.raw && typeof d.cell.raw === 'object' && 'content' in d.cell.raw ? d.cell.raw.content : d.cell.raw;
      if (hasBangla(raw)) {
        const text = String(raw);
        stash.set(d.cell, text);
        d.cell.text = text.split(/\r?\n/).map((l) => l.replace(/\S/g, 'n'));
      }
    },
    willDrawCell(d) {
      if (stash.has(d.cell)) d.cell.text = [''];
    },
    didDrawCell(d) {
      const text = stash.get(d.cell);
      if (!text) return;
      const { cell, doc } = d;
      const padL = cell.padding('left');
      const padR = cell.padding('right');
      const padT = cell.padding('top');
      const padB = cell.padding('bottom');
      const boxW = cell.width - padL - padR;
      const boxH = cell.height - padT - padB;

      const img = banglaImage(text, {
        widthMm: boxW,
        fontPt: cell.styles.fontSize || 9,
        color: cell.styles.textColor,
        bold: cell.styles.fontStyle === 'bold',
      });
      const k = Math.min(1, boxW / img.wMm, boxH / img.hMm); // shrink only if it would overflow the cell
      const w = img.wMm * k;
      const h = img.hMm * k;
      let x = cell.x + padL;
      if (cell.styles.halign === 'right') x = cell.x + cell.width - padR - w;
      else if (cell.styles.halign === 'center') x = cell.x + (cell.width - w) / 2;
      doc.addImage(img.dataUrl, 'PNG', x, cell.y + padT, w, h);
    },
  };
}