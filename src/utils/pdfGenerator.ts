import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuoteResult } from '../types/quote';

interface PDFOptions {
  customerName?: string;
}

// Professional color palette
const COLORS = {
  primary: [37, 99, 235], // Blue-600
  primaryLight: [219, 234, 254], // Blue-100
  dark: [15, 23, 42], // Slate-900
  gray: [107, 114, 128], // Gray-500
  lightGray: [229, 231, 235], // Gray-200
  white: [255, 255, 255],
};

/**
 * Generate a professional estimate PDF
 * Clean, modern design with itemized sections
 */
export async function generateEstimatePDF(
  result: QuoteResult,
  options: PDFOptions = {}
): Promise<void> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
    compress: true, // Enable PDF compression
  });

  const { specs, equipment, stock, costs, quote, mailingServices, totalWithMailing } = result;

  // Generate estimate number
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-4);
  const estimateNumber = `EST-${dateStr}-${timeStr}`;

  let yPos = 20;

  // ==========================================
  // HEADER
  // ==========================================

  // Logo area (left) - Load and add MPA logo
  try {
    const logoImg = new Image();
    logoImg.src = '/mpa-logo.png';
    await new Promise((resolve, reject) => {
      logoImg.onload = resolve;
      logoImg.onerror = reject;
    });

    // Compress image using canvas to reduce PDF size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Set canvas size to a reasonable resolution
    const scale = 2; // 2x for retina displays
    canvas.width = logoImg.width * scale;
    canvas.height = logoImg.height * scale;
    ctx.scale(scale, scale);
    ctx.drawImage(logoImg, 0, 0, logoImg.width, logoImg.height);

    // Convert to compressed JPEG (much smaller than PNG)
    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Calculate dimensions to fit in box without stretching
    const maxWidth = 50;
    const maxHeight = 18;
    const imgAspect = logoImg.width / logoImg.height;
    const boxAspect = maxWidth / maxHeight;

    let logoWidth, logoHeight;
    if (imgAspect > boxAspect) {
      // Image is wider than box - constrain by width
      logoWidth = maxWidth;
      logoHeight = maxWidth / imgAspect;
    } else {
      // Image is taller than box - constrain by height
      logoHeight = maxHeight;
      logoWidth = maxHeight * imgAspect;
    }

    // Center in box
    const logoX = 15 + (maxWidth - logoWidth) / 2;
    const logoY = yPos - 5 + (maxHeight - logoHeight) / 2;

    doc.addImage(compressedDataUrl, 'JPEG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    // Fallback if logo fails to load
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(15, yPos - 5, 50, 18, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.primary);
    doc.setFont('helvetica', 'bold');
    doc.text('MPA', 40, yPos + 5, { align: 'center' });
  }

  // Company info
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.gray);
  doc.setFont('helvetica', 'normal');
  doc.text('Mail Processing Associates', 15, yPos + 20);
  doc.text('Lakeland, FL', 15, yPos + 24);

  // Estimate badge (right)
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(150, yPos - 5, 45, 10, 2, 2, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ESTIMATE', 172.5, yPos + 1, { align: 'center' });

  // Estimate details
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'normal');
  doc.text(`Estimate #: ${estimateNumber}`, 195, yPos + 8, { align: 'right' });
  doc.text(`Date: ${now.toLocaleDateString()}`, 195, yPos + 12, { align: 'right' });

  yPos += 35;

  // ==========================================
  // CUSTOMER & JOB DETAILS
  // ==========================================

  // Customer card
  doc.setDrawColor(...COLORS.lightGray);
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(15, yPos, 85, 20, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('PREPARED FOR', 18, yPos + 5);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'normal');
  doc.text('Customer:', 18, yPos + 10);
  doc.setFont('helvetica', 'bold');
  doc.text(options.customerName || 'Not specified', 38, yPos + 10);

  // Job card
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(105, yPos, 90, 20, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setTextColor(...COLORS.primary);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB DETAILS', 108, yPos + 5);

  doc.setFontSize(8);
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'normal');
  const size = `${specs.finishedWidth}×${specs.finishedHeight}`;
  const colorDesc = specs.color === '4/4' ? '4/4 full color' : specs.color;
  let productName = specs.productType;
  if (specs.productType === 'postcard') productName = 'postcards';
  if (specs.productType === 'flyer') productName = 'flyers';
  if (specs.productType === 'letter') productName = 'letters';

  doc.text(`${size} ${colorDesc} ${productName}`, 108, yPos + 10);

  yPos += 28;

  // ==========================================
  // ITEMIZED TABLE
  // ==========================================

  const tableData: any[] = [];

  // PRINTING SECTION
  tableData.push([
    {
      content: 'PRINTING',
      colSpan: 5,
      styles: {
        fillColor: COLORS.primaryLight,
        textColor: COLORS.primary,
        fontStyle: 'bold',
        fontSize: 9,
      },
    },
  ]);

  tableData.push([
    specs.quantity.toLocaleString(),
    'PRINTING',
    `${size} ${colorDesc} ${productName} on ${stock.name}`,
    `$${(quote / specs.quantity).toFixed(3)}`,
    `$${quote.toFixed(2)}`,
  ]);

  tableData.push([
    '',
    '',
    '',
    {
      content: 'Printing Subtotal:',
      styles: { fontStyle: 'bold', halign: 'right' },
    },
    {
      content: `$${quote.toFixed(2)}`,
      styles: { fontStyle: 'bold', fillColor: COLORS.lightGray },
    },
  ]);

  // MAILING SERVICES SECTIONS
  if (mailingServices) {
    for (const section of mailingServices.sections) {
      // Section header
      tableData.push([
        {
          content: section.name,
          colSpan: 5,
          styles: {
            fillColor: COLORS.primaryLight,
            textColor: COLORS.primary,
            fontStyle: 'bold',
            fontSize: 9,
          },
        },
      ]);

      // Section items
      for (const item of section.items) {
        tableData.push([
          item.quantity.toLocaleString(),
          section.name,
          item.description,
          `$${item.unitPrice.toFixed(3)}`,
          `$${item.total.toFixed(2)}`,
        ]);
      }

      // Section subtotal
      tableData.push([
        '',
        '',
        '',
        {
          content: `${section.name} Subtotal:`,
          styles: { fontStyle: 'bold', halign: 'right' },
        },
        {
          content: `$${section.subtotal.toFixed(2)}`,
          styles: { fontStyle: 'bold', fillColor: COLORS.lightGray },
        },
      ]);
    }
  }

  // Generate table
  autoTable(doc, {
    startY: yPos,
    head: [['QTY', 'SECTION', 'DESCRIPTION', 'UNIT PRICE', 'TOTAL']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.dark,
      textColor: COLORS.white,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.dark,
    },
    columnStyles: {
      0: { cellWidth: 25, halign: 'right' },
      1: { cellWidth: 35, halign: 'left' },
      2: { cellWidth: 85, halign: 'left' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
    didParseCell: (data) => {
      // Skip styling for section headers (already styled)
      if (data.cell.raw && typeof data.cell.raw === 'object' && 'content' in data.cell.raw) {
        return;
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Postage note
  if (mailingServices) {
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.gray);
    doc.setFont('helvetica', 'italic');
    const postageNote = specs.isEDDM
      ? 'USPS EDDM postage billed at actuals (not calculated)'
      : 'USPS postage billed at actuals (not calculated)';
    doc.text(postageNote, 195, yPos, { align: 'right' });
    yPos += 8;
  }

  // ==========================================
  // TOTALS
  // ==========================================

  const totalsData: any[] = [];

  if (mailingServices) {
    totalsData.push([
      'Services Total:',
      `$${(quote + mailingServices.total).toFixed(2)}`,
    ]);
  }

  totalsData.push([
    {
      content: 'ESTIMATE TOTAL:',
      styles: {
        fontStyle: 'bold',
        fontSize: 10,
        fillColor: COLORS.primary,
        textColor: COLORS.white,
      },
    },
    {
      content: `$${(totalWithMailing || quote).toFixed(2)}`,
      styles: {
        fontStyle: 'bold',
        fontSize: 10,
        fillColor: COLORS.primary,
        textColor: COLORS.white,
      },
    },
  ]);

  autoTable(doc, {
    startY: yPos,
    body: totalsData,
    theme: 'plain',
    bodyStyles: {
      fontSize: 9,
      halign: 'right',
    },
    columnStyles: {
      0: { cellWidth: 160 },
      1: { cellWidth: 35, fontStyle: 'bold' },
    },
    margin: { left: 0 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // ==========================================
  // FOOTER
  // ==========================================

  doc.setDrawColor(...COLORS.lightGray);
  doc.line(15, yPos, 195, yPos);

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.gray);
  doc.text('Mail Processing Associates • Lakeland, FL', 15, yPos + 4);
  doc.text(`Estimate ${estimateNumber}`, 195, yPos + 4, { align: 'right' });

  // ==========================================
  // SAVE / PREVIEW
  // ==========================================

  const filename = options.customerName
    ? `MPA-Estimate-${estimateNumber}-${options.customerName.replace(/\s+/g, '-')}.pdf`
    : `MPA-Estimate-${estimateNumber}.pdf`;

  // Open in new window for print preview
  const pdfBlob = doc.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(pdfUrl, '_blank');

  // Also offer download
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.document.title = filename;
    };
  } else {
    // Fallback to direct download if popup blocked
    doc.save(filename);
  }
}
