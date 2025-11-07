import { ProductType } from '../types/quote';

// Multiplier tiers by product type and quantity
export function getMultiplier(productType: ProductType, quantity: number): number {
  switch (productType) {
    case 'booklet':
      if (quantity <= 250) return 4.0;
      if (quantity <= 500) return 3.0;
      if (quantity <= 1000) return 2.8;
      if (quantity <= 2500) return 2.6;
      if (quantity <= 10000) return 2.4;
      return 2.2;

    case 'postcard':
    case 'flyer':
    case 'brochure':
      if (quantity <= 250) return 5.5;
      if (quantity <= 500) return 4.5;
      if (quantity <= 1000) return 3.8;
      if (quantity <= 2500) return 3.3;
      if (quantity <= 10000) return 3.0;
      if (quantity <= 15000) return 2.5;
      return 2.2;

    case 'envelope':
      if (quantity <= 250) return 5.0;
      if (quantity <= 500) return 4.0;
      if (quantity <= 1000) return 3.5;
      if (quantity <= 5000) return 3.0;
      return 2.5;

    case 'letter':
      if (quantity <= 250) return 4.5;
      if (quantity <= 1000) return 3.5;
      if (quantity <= 5000) return 3.0;
      return 2.5;

    default:
      return 3.8; // Safe default
  }
}

// Spoilage tiers by quantity
export function getSpoilage(quantity: number): { factor: number; percent: string } {
  if (quantity <= 250) return { factor: 1.05, percent: '5%' };
  if (quantity <= 500) return { factor: 1.04, percent: '4%' };
  if (quantity <= 1000) return { factor: 1.03, percent: '3%' };
  if (quantity <= 2500) return { factor: 1.025, percent: '2.5%' };
  return { factor: 1.02, percent: '2%' };
}

// Mailing service rates
export const mailingRates = {
  eddm: {
    bundling: 0.035,
    description: 'EDDM Bundling & Paperwork',
  },
  addressed: {
    postcard: 0.059,
    selfMailer: 0.109,
    letter: 0.079,
    letterExtraInsert: 0.01,
  },
};

// Profit floors by product type
export function getMarginFloor(productType: ProductType): number {
  switch (productType) {
    case 'postcard':
    case 'flyer':
    case 'brochure':
      return 30; // 30% minimum

    case 'booklet':
      return 35; // 35% minimum

    default:
      return 30; // Safe default
  }
}

// Shop minimum
export const SHOP_MINIMUM = 75.0;
