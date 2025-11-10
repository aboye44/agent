import { QuoteResult } from '../types/quote';

/**
 * Format quote result into human-readable text
 * Replaces the Python print statements
 */
export function formatQuote(result: QuoteResult): string {
  const { specs, equipment, stock, imposition, costs, multiplier, quote, marginPercent, mailingServices, totalWithMailing, qa } = result;

  let output = `Quote: $${quote.toFixed(2)}\n\n`;

  // Production section
  output += `Production:\n`;
  output += `• Equipment: ${equipment.name}\n`;
  output += `• Stock: ${stock.name}\n`;
  if (imposition.upCount > 1) {
    output += `• Imposition: ${imposition.upCount}-up\n`;
  }
  output += `• Press Sheets: ${imposition.pressSheets} (includes ${imposition.spoilagePct} spoilage)\n\n`;

  // Cost section
  output += `Cost (internal):\n`;
  output += `• Paper: $${costs.paperCost.toFixed(2)} ($${(costs.paperCost / specs.quantity).toFixed(4)}/pc)\n`;
  output += `• Clicks: $${costs.clickCost.toFixed(2)} ($${(costs.clickCost / specs.quantity).toFixed(4)}/pc)\n`;
  if (costs.finishingCost > 0) {
    output += `• Stitching: $${costs.finishingCost.toFixed(2)} ($${(costs.finishingCost / specs.quantity).toFixed(4)}/pc) [includes $100 overhead]\n`;
  } else {
    output += `• Stitching: $0.00 ($0.0000/pc)\n`;
  }
  output += `• TOTAL COST: $${costs.totalCost.toFixed(2)} ($${(costs.totalCost / specs.quantity).toFixed(4)}/pc)\n\n`;

  // Quote section
  output += `QUOTE: $${quote.toFixed(2)} ($${(quote / specs.quantity).toFixed(4)}/pc • ${multiplier}× • ${Math.round(marginPercent)}% margin)\n`;

  // Mailing services (if applicable)
  if (mailingServices && totalWithMailing) {
    output += `\n`;

    // Display each section with itemized breakdown
    for (const section of mailingServices.sections) {
      output += `\n${section.name}:\n`;
      for (const item of section.items) {
        output += `• ${item.description}: ${item.quantity.toLocaleString()} × $${item.unitPrice.toFixed(3)} = $${item.total.toFixed(2)}\n`;
      }
      output += `${section.name} Subtotal: $${section.subtotal.toFixed(2)}\n`;
    }

    // Postage note
    output += `\nPostage: ${specs.isEDDM ? 'USPS EDDM' : 'USPS'} postage billed at actuals (not calculated)\n\n`;

    // Grand total
    const label = specs.isEDDM ? 'EDDM Bundling' : 'Mail Services';
    output += `TOTAL (Printing + ${label}): $${totalWithMailing.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
  }

  // QA Summary
  output += `\n═══════════════════════════════════════════\n`;
  output += `QA SUMMARY\n`;
  output += `═══════════════════════════════════════════\n`;
  output += `• Device: ${equipment.name}\n`;
  output += `• Spoilage: ${imposition.spoilagePct}\n`;
  output += `• Press Sheets: ${imposition.pressSheets}\n`;
  output += `• Paper: $${costs.paperCost.toFixed(2)}\n`;
  output += `• Clicks: $${costs.clickCost.toFixed(2)}\n`;
  if (costs.finishingCost > 0) {
    output += `• Finishing: $${costs.finishingCost.toFixed(2)}\n`;
  } else {
    output += `• Finishing: $0.00\n`;
  }
  output += `• GM%: ${Math.round(marginPercent)}%\n`;

  const passedChecks = Object.values(qa).filter(Boolean).length;
  const totalChecks = Object.keys(qa).length;
  output += `• Checks Passed: ${passedChecks}/${totalChecks}\n`;
  output += `═══════════════════════════════════════════\n`;

  // QA failures
  if (passedChecks < totalChecks) {
    output += `\n❌ QA FAILED - Quote cannot be issued with failed checks\n`;
    if (!qa.deviceRouting) output += `• Device routing error\n`;
    if (!qa.spoilageApplied) output += `• Spoilage not applied\n`;
    if (!qa.paperCostCalculated) output += `• Paper cost is zero\n`;
    if (!qa.clickCostCalculated) output += `• Click cost is zero\n`;
    if (!qa.marginMeetsFloor) output += `• Margin below profit floor\n`;
    if (!qa.meetsShopMinimum) output += `• Quote below $75 shop minimum\n`;
  }

  return output;
}
