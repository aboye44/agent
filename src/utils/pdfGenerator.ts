import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { QuoteResult } from '../types/quote';

interface PDFOptions {
  customerName?: string;
}

/**
 * Generate a professional estimate PDF
 * MailShop-style with itemized sections
 */
export async function generateEstimatePDF(
  result: QuoteResult,
  options: PDFOptions = {}
): Promise<void> {
  const doc = new jsPDF();
  const { specs, equipment, stock, costs, quote, mailingServices, totalWithMailing } = result;

  // Colors
  const primaryBlue = '#3b82f6';
  const darkGray = '#1f2937';
  const lightGray = '#6b7280';

  let yPosition = 20;

  // ===============================
  // HEADER: Logo + Company Info
  // ===============================
  try {
    // Load and add logo
    const logoImg = await loadImage('/mpa-logo.png');
    doc.addImage(logoImg, 'PNG', 15, yPosition, 40, 15);
  } catch (err) {
    console.error('Logo not found, skipping:', err);
    // Continue without logo
  }

  // Company info (right side)
  doc.setFontSize(10);
  doc.setTextColor(darkGray);
  doc.text('Mail Processing Associates', 200, yPosition + 5, { align: 'right' });
  doc.text('Lakeland, FL', 200, yPosition + 10, { align: 'right' });

  yPosition += 25;

  // ===============================
  // ESTIMATE HEADER
  // ===============================
  doc.setFontSize(18);
  doc.setTextColor(primaryBlue);
  doc.text('ESTIMATE', 15, yPosition);

  // Generate estimate number based on date + timestamp
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-4);
  const estimateNumber = `EST-${dateStr}-${timeStr}`;

  doc.setFontSize(10);
  doc.setTextColor(lightGray);
  doc.text(`Estimate #: ${estimateNumber}`, 200, yPosition, { align: 'right' });
  doc.text(`Date: ${now.toLocaleDateString()}`, 200, yPosition + 5, { align: 'right' });

  yPosition += 15;

  // Customer name (if provided)
  if (options.customerName) {
    doc.setFontSize(11);
    doc.setTextColor(darkGray);
    doc.text(`Customer: ${options.customerName}`, 15, yPosition);
    yPosition += 10;
  }

  // ===============================
  // PRINTING SECTION
  // ===============================
  yPosition += 5;

  const printingData = [
    [
      specs.quantity.toLocaleString(),
      'PRINTING',
      getProductDescription(specs, stock),
      `$${(quote / specs.quantity).toFixed(3)}/ea`,
      `$${quote.toFixed(2)}`,
    ],
  ];

  autoTable(doc, {
    startY: yPosition,
    head: [['QTY', 'SECTION', 'DESCRIPTION', 'UNIT PRICE', 'TOTAL']],
    body: printingData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryBlue,
      textColor: '#ffffff',
      fontSize: 9,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: darkGray,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: 75 },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 25, halign: 'right' },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // ===============================
  // MAILING SERVICES (if applicable)
  // ===============================
  if (mailingServices && mailingServices.sections.length > 0) {
    const mailingData: any[] = [];

    for (const section of mailingServices.sections) {
      for (const item of section.items) {
        mailingData.push([
          item.quantity.toLocaleString(),
          section.name,
          item.description,
          `$${item.unitPrice.toFixed(3)}/ea`,
          `$${item.total.toFixed(2)}`,
        ]);
      }

      // Subtotal row
      mailingData.push([
        '',
        '',
        `${section.name} Subtotal:`,
        '',
        `$${section.subtotal.toFixed(2)}`,
      ]);
    }

    autoTable(doc, {
      startY: yPosition,
      body: mailingData,
      theme: 'grid',
      bodyStyles: {
        fontSize: 9,
        textColor: darkGray,
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 75 },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        // Bold subtotal rows
        if (data.row.raw[2]?.includes('Subtotal')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = '#f3f4f6';
        }
      },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 5;

    // Postage note
    doc.setFontSize(9);
    doc.setTextColor(lightGray);
    doc.text(
      `Postage: ${specs.isEDDM ? 'USPS EDDM' : 'USPS'} postage billed at actuals (not calculated)`,
      15,
      yPosition
    );
    yPosition += 10;
  }

  // ===============================
  // TOTALS
  // ===============================
  const totalsData: any[] = [];

  if (mailingServices) {
    totalsData.push(['Services Total:', `$${(quote + mailingServices.total).toFixed(2)}`]);
    if (mailingServices.postage) {
      totalsData.push(['Postage:', `$${mailingServices.postage.total.toFixed(2)}`]);
    }
  }

  if (totalWithMailing) {
    totalsData.push(['**ESTIMATE TOTAL:**', `**$${totalWithMailing.toFixed(2)}**`]);
  } else {
    totalsData.push(['**ESTIMATE TOTAL:**', `**$${quote.toFixed(2)}**`]);
  }

  autoTable(doc, {
    startY: yPosition,
    body: totalsData,
    theme: 'plain',
    bodyStyles: {
      fontSize: 11,
      textColor: darkGray,
    },
    columnStyles: {
      0: { cellWidth: 160, halign: 'right', fontStyle: 'bold' },
      1: { cellWidth: 25, halign: 'right', fontStyle: 'bold', textColor: primaryBlue },
    },
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // ===============================
  // PRODUCTION SPECS (Footer area)
  // ===============================
  if (yPosition > 240) {
    doc.addPage();
    yPosition = 20;
  }

  doc.setFontSize(9);
  doc.setTextColor(lightGray);
  doc.text('Production Specifications:', 15, yPosition);
  yPosition += 5;

  doc.setFontSize(8);
  doc.text(`Equipment: ${equipment.name}`, 15, yPosition);
  yPosition += 4;
  doc.text(`Stock: ${stock.name}`, 15, yPosition);
  yPosition += 4;
  doc.text(
    `Paper Cost: $${costs.paperCost.toFixed(2)} | Click Cost: $${costs.clickCost.toFixed(2)}`,
    15,
    yPosition
  );

  // ===============================
  // SAVE PDF
  // ===============================
  const filename = options.customerName
    ? `MPA-Estimate-${estimateNumber}-${options.customerName.replace(/\s+/g, '-')}.pdf`
    : `MPA-Estimate-${estimateNumber}.pdf`;

  doc.save(filename);
}

/**
 * Helper: Generate product description for PDF
 */
function getProductDescription(specs: any, stock: any): string {
  const { finishedWidth, finishedHeight, color, productType } = specs;
  const size = `${finishedWidth}×${finishedHeight}`;
  const colorDesc = color === '4/4' ? '4/4 (full color both sides)' : color;

  let productName = productType;
  if (productType === 'postcard') productName = 'postcards';
  if (productType === 'flyer') productName = 'flyers';
  if (productType === 'letter') productName = 'letters';
  if (productType === 'envelope') productName = 'envelopes';
  if (productType === 'booklet') productName = 'booklets';

  return `${size} ${colorDesc} ${productName} on ${stock.name}`;
}

/**
 * Helper: Load image as base64
 */
function loadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } else {
        reject(new Error('Canvas context unavailable'));
      }
    };
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}
