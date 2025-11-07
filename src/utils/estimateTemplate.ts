import { QuoteResult } from '../types/quote';

interface EstimateData {
  estimateNumber: string;
  estimateDate: string;
  customerName?: string;
  jobDescription: string;
  printingSection: {
    items: Array<{
      qty: number;
      desc: string;
      unitPrice: number;
      total: number;
      subnote?: string;
    }>;
    subtotal: number;
  };
  dataProcessingSection?: {
    items: Array<{
      qty: number;
      desc: string;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
  };
  lettershopSection?: {
    items: Array<{
      qty: number;
      desc: string;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
  };
  servicesSubtotal: number;
  postageNote: string;
  grandTotal: number;
  productionDetails: {
    equipment: string;
    stock: string;
    imposition?: string;
    clickPaper: string;
  };
}

/**
 * Convert QuoteResult into template data
 */
export function prepareEstimateData(result: QuoteResult, customerName?: string): EstimateData {
  const { specs, equipment, stock, imposition, costs, quote, mailingServices, totalWithMailing } = result;

  // Generate estimate number
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.getTime().toString().slice(-4);
  const estimateNumber = `EST-${dateStr}-${timeStr}`;

  // Job description
  const size = `${specs.finishedWidth}×${specs.finishedHeight}`;
  const colorDesc = specs.color === '4/4' ? 'full color both sides' : specs.color;
  let productName = specs.productType;
  if (specs.productType === 'postcard') productName = 'postcards';
  if (specs.productType === 'flyer') productName = 'flyers';
  if (specs.productType === 'letter') productName = 'letters';
  if (specs.productType === 'envelope') productName = 'envelopes';
  if (specs.productType === 'booklet') productName = 'booklets';

  const jobDescription = `${size} ${colorDesc} ${productName} on ${stock.name}`;

  // PRINTING section
  const printingSection = {
    items: [
      {
        qty: specs.quantity,
        desc: jobDescription,
        unitPrice: quote / specs.quantity,
        total: quote,
        subnote: `Equipment: ${equipment.name} • Stock: ${stock.name}`,
      },
    ],
    subtotal: quote,
  };

  // Data structures for mailing sections
  let dataProcessingSection;
  let lettershopSection;
  let servicesSubtotal = quote;
  let postageNote = '';

  if (mailingServices) {
    // Find DATA PROCESSING section
    const dataSection = mailingServices.sections.find((s) => s.name === 'DATA PROCESSING');
    if (dataSection) {
      dataProcessingSection = {
        items: dataSection.items.map((item) => ({
          qty: item.quantity,
          desc: item.description,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal: dataSection.subtotal,
      };
    }

    // Find LETTERSHOP section
    const lettershop = mailingServices.sections.find((s) => s.name === 'LETTERSHOP');
    if (lettershop) {
      lettershopSection = {
        items: lettershop.items.map((item) => ({
          qty: item.quantity,
          desc: item.description,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        subtotal: lettershop.subtotal,
      };
    }

    servicesSubtotal = quote + mailingServices.total;
    postageNote = specs.isEDDM
      ? 'USPS EDDM postage billed at actuals (not calculated)'
      : 'USPS postage billed at actuals (not calculated)';
  }

  const grandTotal = totalWithMailing || quote;

  // Production details
  const productionDetails = {
    equipment: equipment.name,
    stock: stock.name,
    imposition: imposition.upCount > 1 ? `${imposition.upCount}-up` : undefined,
    clickPaper: `Paper $${costs.paperCost.toFixed(2)} • Clicks $${costs.clickCost.toFixed(2)}`,
  };

  return {
    estimateNumber,
    estimateDate: now.toLocaleDateString(),
    customerName,
    jobDescription,
    printingSection,
    dataProcessingSection,
    lettershopSection,
    servicesSubtotal,
    postageNote,
    grandTotal,
    productionDetails,
  };
}

/**
 * Generate HTML estimate from template data
 */
export function generateEstimateHTML(data: EstimateData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Estimate ${data.estimateNumber} — Mail Processing Associates</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>

  <style>
    /* ------- Base ------- */
    :root{
      --ink:#0F172A;            /* MPA Navy */
      --accent:#2563EB;         /* Accent Blue */
      --muted:#6B7280;          /* Muted Gray */
      --hair:#E5E7EB;           /* Hairline Gray */
      --bg:#F8FAFC;             /* Page tint */
      --ok:#16A34A;             /* CTA green */
    }
    @page{
      size: Letter;
      margin: 24mm 18mm 20mm 18mm;
    }
    *{ box-sizing:border-box; }
    body{
      font: 12px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol";
      color: var(--ink);
      background: white;
      margin: 20px;
    }
    h1,h2,h3{ margin:0 0 6px 0; line-height:1.2; }
    h1{ font-size:20px; letter-spacing:0.3px; }
    h2{ font-size:14px; color:var(--accent); text-transform:uppercase; letter-spacing:.6px; }
    h3{ font-size:12px; color:var(--muted); text-transform:uppercase; letter-spacing:.6px; }
    .small{ font-size:11px; color:var(--muted); }
    .muted{ color:var(--muted); }

    /* ------- Header ------- */
    .header{
      display:flex; align-items:flex-start; justify-content:space-between;
      border-bottom:1px solid var(--hair); padding-bottom:12px; margin-bottom:14px;
    }
    .brand{
      display:flex; gap:12px; align-items:center;
    }
    .brand-logo{
      width:110px; height:36px; object-fit:contain; background:#fff; border:1px solid var(--hair); border-radius:6px; padding:6px;
    }
    .brand-lines{ font-size:11px; color:var(--muted); }
    .meta{
      text-align:right;
    }
    .meta .badge{
      display:inline-block; background:var(--bg); color:var(--accent);
      border:1px solid var(--hair); padding:6px 10px; border-radius:8px; font-weight:600;
    }

    /* ------- Party blocks ------- */
    .party{
      display:grid; grid-template-columns: 1fr 1fr; gap:14px;
      margin-bottom:12px;
    }
    .card{
      border:1px solid var(--hair); border-radius:10px; padding:10px 12px; background:#fff;
    }
    .grid-two{
      display:grid; grid-template-columns: 110px 1fr; row-gap:6px; column-gap:8px;
    }
    .label{ color:var(--muted); }
    .value{ color:var(--ink); }

    /* ------- Line table ------- */
    .lines{
      width:100%; border-collapse:collapse; margin-top:6px; margin-bottom:4px;
    }
    .lines th, .lines td{
      padding:8px 8px; vertical-align:top;
      border-bottom:1px solid var(--hair);
    }
    .lines th{
      font-size:11px; color:var(--muted); text-transform:uppercase; letter-spacing:.6px;
      background:#FAFAFB;
    }
    .lines .section-row td{
      background:#F6FAFF; color:var(--accent); font-weight:700; border-top:1px solid var(--hair);
    }
    .qty, .unit, .money, .total{ text-align:right; white-space:nowrap; }
    .desc{ width:55%; }

    .subline{
      color:var(--muted); font-size:11px; margin-top:4px;
    }
    .section-subtotal{
      text-align:right; padding:6px 8px; font-weight:700;
      border-bottom:1px solid var(--hair); background:#FBFDFF;
    }

    /* ------- Totals block ------- */
    .totals{
      margin-top:10px; margin-left:auto; width:320px;
      border:1px solid var(--hair); border-radius:10px; overflow:hidden;
    }
    .totals-row{
      display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid var(--hair);
    }
    .totals-row.label{ color:var(--muted); }
    .totals-row.emph{ background:#F3F6FF; font-weight:800; }
    .totals-row:last-child{ border-bottom:none; }

    /* ------- Spec & Terms ------- */
    .cols{
      display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-top:14px;
    }
    .box{
      border:1px solid var(--hair); border-radius:10px; padding:10px 12px; background:#fff;
    }
    .bullet{ margin:0; padding-left:16px; }
    .bullet li{ margin:2px 0; }

    /* ------- Footer ------- */
    .footer{
      margin-top:12px; padding-top:8px; border-top:1px solid var(--hair);
      display:flex; justify-content:space-between; align-items:center; color:var(--muted); font-size:10px;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <header class="header">
    <div class="brand">
      <img class="brand-logo" src="/mpa-logo.png" alt="Mail Processing Associates"/>
      <div class="brand-lines">
        Lakeland, FL • www.mailpro.org
      </div>
    </div>

    <div class="meta">
      <div class="badge">ESTIMATE</div>
      <div class="small">Estimate # <strong>${data.estimateNumber}</strong></div>
      <div class="small">Date: <strong>${data.estimateDate}</strong></div>
    </div>
  </header>

  <!-- Customer & Job -->
  <section class="party">
    <div class="card">
      <h3>Prepared For</h3>
      <div class="grid-two">
        <div class="label">Customer</div><div class="value">${data.customerName || 'Not specified'}</div>
      </div>
    </div>

    <div class="card">
      <h3>Job Details</h3>
      <div class="grid-two">
        <div class="label">Description</div><div class="value">${data.jobDescription}</div>
      </div>
    </div>
  </section>

  <!-- Lines -->
  <table class="lines">
    <thead>
      <tr>
        <th class="qty">QTY</th>
        <th>SECTION</th>
        <th class="desc">DESCRIPTION</th>
        <th class="unit">UNIT PRICE</th>
        <th class="total">TOTAL</th>
      </tr>
    </thead>
    <tbody>
      <!-- PRINTING -->
      <tr class="section-row"><td colspan="5">PRINTING</td></tr>
      ${data.printingSection.items
        .map(
          (item) => `
        <tr>
          <td class="qty">${item.qty.toLocaleString()}</td>
          <td>PRINTING</td>
          <td class="desc">
            ${item.desc}
            ${item.subnote ? `<div class="subline">${item.subnote}</div>` : ''}
          </td>
          <td class="unit">$${item.unitPrice.toFixed(3)}/ea</td>
          <td class="total"><strong>$${item.total.toFixed(2)}</strong></td>
        </tr>
      `
        )
        .join('')}
      <tr><td colspan="5" class="section-subtotal">Printing Subtotal: $${data.printingSection.subtotal.toFixed(2)}</td></tr>

      ${
        data.dataProcessingSection
          ? `
      <!-- DATA PROCESSING -->
      <tr class="section-row"><td colspan="5">DATA PROCESSING</td></tr>
      ${data.dataProcessingSection.items
        .map(
          (item) => `
        <tr>
          <td class="qty">${item.qty.toLocaleString()}</td>
          <td>DATA PROCESSING</td>
          <td class="desc">${item.desc}</td>
          <td class="unit">$${item.unitPrice.toFixed(3)}/ea</td>
          <td class="total"><strong>$${item.total.toFixed(2)}</strong></td>
        </tr>
      `
        )
        .join('')}
      <tr><td colspan="5" class="section-subtotal">Data Processing Subtotal: $${data.dataProcessingSection.subtotal.toFixed(2)}</td></tr>
      `
          : ''
      }

      ${
        data.lettershopSection
          ? `
      <!-- LETTERSHOP -->
      <tr class="section-row"><td colspan="5">LETTERSHOP</td></tr>
      ${data.lettershopSection.items
        .map(
          (item) => `
        <tr>
          <td class="qty">${item.qty.toLocaleString()}</td>
          <td>LETTERSHOP</td>
          <td class="desc">${item.desc}</td>
          <td class="unit">$${item.unitPrice.toFixed(3)}/ea</td>
          <td class="total"><strong>$${item.total.toFixed(2)}</strong></td>
        </tr>
      `
        )
        .join('')}
      <tr><td colspan="5" class="section-subtotal">Lettershop Subtotal: $${data.lettershopSection.subtotal.toFixed(2)}</td></tr>
      `
          : ''
      }
    </tbody>
  </table>

  <!-- Totals -->
  <div class="totals">
    <div class="totals-row label"><div>Subtotal (Services)</div><div>$${data.servicesSubtotal.toFixed(2)}</div></div>
    ${data.postageNote ? `<div class="totals-row label"><div>Postage</div><div>Billed at actuals</div></div>` : ''}
    <div class="totals-row emph"><div>Estimate Total</div><div>$${data.grandTotal.toFixed(2)}</div></div>
  </div>

  ${
    data.postageNote
      ? `<div class="small" style="margin-top:8px; text-align:right; color:var(--muted);">${data.postageNote}</div>`
      : ''
  }

  <!-- Specs -->
  <div class="cols">
    <div class="box">
      <h2>Production Details</h2>
      <ul class="bullet">
        <li><strong>Equipment:</strong> ${data.productionDetails.equipment}</li>
        <li><strong>Stock:</strong> ${data.productionDetails.stock}</li>
        ${data.productionDetails.imposition ? `<li><strong>Imposition:</strong> ${data.productionDetails.imposition}</li>` : ''}
        <li><strong>Costs:</strong> ${data.productionDetails.clickPaper}</li>
      </ul>
    </div>

    <div class="box">
      <h2>Terms & Notes</h2>
      <ul class="bullet">
        <li>Estimate valid 14 days.</li>
        <li>Postage is billed at exacts and must be funded prior to mail drop.</li>
        <li>Production time starts after final proof approval.</li>
      </ul>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div>Mail Processing Associates • Veteran-Owned • Lakeland, FL</div>
    <div>Estimate ${data.estimateNumber}</div>
  </footer>
</body>
</html>`;
}
