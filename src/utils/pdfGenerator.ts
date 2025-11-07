import html2pdf from 'html2pdf.js';
import { QuoteResult } from '../types/quote';
import { prepareEstimateData, generateEstimateHTML } from './estimateTemplate';

interface PDFOptions {
  customerName?: string;
}

/**
 * Generate a professional estimate PDF using HTML template
 * Clean, modern design matching MailShop style
 */
export async function generateEstimatePDF(
  result: QuoteResult,
  options: PDFOptions = {}
): Promise<void> {
  // Prepare template data
  const templateData = prepareEstimateData(result, options.customerName);

  // Generate HTML
  const html = generateEstimateHTML(templateData);

  // Create temporary container
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  document.body.appendChild(container);

  // Configure html2pdf options
  const opt = {
    margin: [10, 10, 10, 10],
    filename: options.customerName
      ? `MPA-Estimate-${templateData.estimateNumber}-${options.customerName.replace(/\s+/g, '-')}.pdf`
      : `MPA-Estimate-${templateData.estimateNumber}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      logging: false,
    },
    jsPDF: {
      unit: 'mm',
      format: 'letter',
      orientation: 'portrait'
    },
  };

  try {
    // Generate PDF
    await html2pdf().set(opt).from(container).save();
  } finally {
    // Clean up
    document.body.removeChild(container);
  }
}
