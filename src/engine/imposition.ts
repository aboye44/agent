import { ProductType, ImpositionResult } from '../types/quote';
import { getSpoilage } from '../data/pricingTiers';

/**
 * Calculate imposition (how many pieces fit on a sheet)
 * Returns the "up count" for optimal sheet utilization
 */
export function calculateImposition(
  finishedWidth: number,
  finishedHeight: number,
  sheetWidth: number,
  sheetHeight: number,
  bleed: number = 0.25
): number {
  const liveWidth = finishedWidth + bleed;
  const liveHeight = finishedHeight + bleed;

  // Try both orientations
  const orient1 = Math.floor(sheetWidth / liveWidth) * Math.floor(sheetHeight / liveHeight);
  const orient2 = Math.floor(sheetWidth / liveHeight) * Math.floor(sheetHeight / liveWidth);

  return Math.max(orient1, orient2);
}

/**
 * Calculate press sheets with spoilage applied ONCE
 */
export function calculatePressSheets(
  productType: ProductType,
  quantity: number,
  upCount?: number,
  totalPages?: number
): ImpositionResult {
  const spoilage = getSpoilage(quantity);
  let rawSheets: number;

  switch (productType) {
    case 'postcard':
    case 'flyer':
    case 'brochure':
      if (!upCount) throw new Error('upCount required for flats');
      rawSheets = Math.ceil(quantity / upCount);
      break;

    case 'booklet':
      if (!totalPages) throw new Error('totalPages required for booklets');
      const sheetsPerBooklet = 1 + (totalPages - 4) / 4;
      rawSheets = quantity * sheetsPerBooklet;
      break;

    case 'letter':
      rawSheets = upCount && upCount > 1 ? Math.ceil(quantity / upCount) : quantity;
      break;

    case 'envelope':
      rawSheets = quantity; // 1-up
      break;

    default:
      rawSheets = quantity;
  }

  const pressSheets = Math.ceil(rawSheets * spoilage.factor);

  return {
    upCount: upCount || 1,
    pressSheets,
    spoilagePct: spoilage.percent,
    spoilageFactor: spoilage.factor,
  };
}
