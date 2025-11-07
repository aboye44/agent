// Core types for the MPA quoting system

export type ProductType = 'postcard' | 'flyer' | 'brochure' | 'booklet' | 'letter' | 'envelope';

export type ColorSpec = '4/4' | '4/0' | '1/1' | '1/0';

export interface PaperStock {
  name: string;
  sku: string;
  sheetSize: [number, number]; // [width, height] in inches
  costPerSheet: number;
  category: 'text' | 'cover' | 'envelope' | 'letter';
}

export interface Equipment {
  name: string;
  clickRate: number; // cost per click/side
  deviceType: 'color' | 'bw' | 'envelope-color' | 'envelope-bw';
}

export interface QuoteSpecs {
  quantity: number;
  productType: ProductType;
  finishedWidth: number;
  finishedHeight: number;
  color: ColorSpec;
  stockName?: string; // Optional - will use defaults if not specified
  totalPages?: number; // Required for booklets
  wantsMailing?: boolean;
  isEDDM?: boolean;
}

export interface ImpositionResult {
  upCount: number;
  pressSheets: number;
  spoilagePct: string;
  spoilageFactor: number;
}

export interface CostBreakdown {
  paperCost: number;
  clickCost: number;
  finishingCost: number;
  totalCost: number;
}

export interface QuoteResult {
  specs: QuoteSpecs;
  equipment: Equipment;
  stock: PaperStock;
  imposition: ImpositionResult;
  costs: CostBreakdown;
  multiplier: number;
  quote: number;
  marginPercent: number;
  mailingServices?: {
    cost: number;
    description: string;
  };
  totalWithMailing?: number;
  qa: {
    deviceRouting: boolean;
    spoilageApplied: boolean;
    paperCostCalculated: boolean;
    clickCostCalculated: boolean;
    marginMeetsFloor: boolean;
    meetsShopMinimum: boolean;
  };
}
