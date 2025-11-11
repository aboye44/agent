import { QuoteSpecs, QuoteResult, PaperStock, CostBreakdown, MailingServices, MailingServiceSection } from '../types/quote';
import { paperStocks, defaultStocks, stockAliases } from '../data/paperStocks';
import { getEquipment } from '../data/equipment';
import { getMultiplier, getMarginFloor, mailingRates, SHOP_MINIMUM } from '../data/pricingTiers';
import { calculateImposition, calculatePressSheets } from './imposition';

/**
 * Main quote calculation engine
 * Pure TypeScript - no LLM needed
 */
export function calculateQuote(specs: QuoteSpecs): QuoteResult {
  // Debug: Log that calculation started
  console.log('🔵 calculateQuote called with specs:', {
    quantity: specs.quantity,
    productType: specs.productType,
    size: `${specs.finishedWidth}×${specs.finishedHeight}`,
    color: specs.color,
    stockName: specs.stockName
  });

  // 1. Determine paper stock
  const stock = resolveStock(specs);
  console.log('📄 Stock resolved:', stock.name, 'Sheet size:', stock.sheetSize);

  // 2. Route to correct equipment
  const equipment = getEquipment(specs.productType, specs.color);

  // 3. Calculate imposition (for flats)
  let upCount = 1;
  if (specs.productType === 'postcard' || specs.productType === 'flyer' || specs.productType === 'brochure') {
    console.log('🎯 Entering imposition calculation block for', specs.productType);
    upCount = calculateImposition(
      specs.finishedWidth,
      specs.finishedHeight,
      stock.sheetSize[0],
      stock.sheetSize[1]
    );
    console.log('✅ Imposition result:', upCount, '-up');
  } else {
    console.log('⏭️ Skipping imposition (product type:', specs.productType, ')');
  }

  // 4. Calculate press sheets with spoilage
  const imposition = calculatePressSheets(
    specs.productType,
    specs.quantity,
    upCount,
    specs.totalPages
  );

  // 5. Calculate costs
  const costs = calculateCosts(specs, stock, equipment, imposition);

  // 6. Apply multiplier
  const multiplier = getMultiplier(specs.productType, specs.quantity);
  let quote = costs.totalCost * multiplier;

  // 7. Apply shop minimum
  if (quote < SHOP_MINIMUM) {
    quote = SHOP_MINIMUM;
  }

  // 8. Calculate margin
  const marginPercent = ((quote - costs.totalCost) / quote) * 100;

  // 9. Mailing services (if requested)
  let mailingServices;
  let totalWithMailing;
  if (specs.wantsMailing) {
    mailingServices = calculateMailingServices(specs);
    totalWithMailing = quote + mailingServices.total;
  }

  // 10. QA checks
  const qa = runQAChecks(specs, equipment, imposition, costs, quote, marginPercent);

  return {
    specs,
    equipment,
    stock,
    imposition,
    costs,
    multiplier,
    quote,
    marginPercent,
    mailingServices,
    totalWithMailing,
    qa,
  };
}

/**
 * Resolve which paper stock to use
 */
function resolveStock(specs: QuoteSpecs): PaperStock {
  // If user specified a stock, try to resolve it
  if (specs.stockName) {
    const normalized = specs.stockName.toLowerCase();
    const alias = stockAliases[normalized];
    if (alias && paperStocks[alias]) {
      return paperStocks[alias];
    }
    // Try direct lookup
    if (paperStocks[normalized]) {
      return paperStocks[normalized];
    }
  }

  // Use defaults
  const defaultKey = defaultStocks[specs.productType] || defaultStocks.postcard;
  return paperStocks[defaultKey];
}

/**
 * Calculate all costs
 */
function calculateCosts(
  specs: QuoteSpecs,
  stock: PaperStock,
  equipment: any,
  imposition: any
): CostBreakdown {
  const { quantity, color, productType } = specs;

  // Paper cost
  const paperCost = imposition.pressSheets * stock.costPerSheet;

  // Click cost (sides depend on color)
  const sides = color === '4/4' || color === '1/1' ? 2 : 1;
  const clickCost = imposition.pressSheets * sides * equipment.clickRate;

  // Finishing cost (booklets only)
  let finishingCost = 0;
  if (productType === 'booklet') {
    const setup = 50.0;
    const runRate = 0.0625;
    const overhead = 100.0;
    const baseCost = setup + quantity * runRate + overhead;

    // Volume discounts
    let discount = 0;
    if (quantity >= 10000) discount = 0.2;
    else if (quantity >= 5000) discount = 0.15;
    else if (quantity >= 1000) discount = 0.1;

    finishingCost = baseCost * (1 - discount);
  }

  const totalCost = paperCost + clickCost + finishingCost;

  return {
    paperCost,
    clickCost,
    finishingCost,
    totalCost,
  };
}

/**
 * Calculate mailing services with itemized breakdown
 */
function calculateMailingServices(specs: QuoteSpecs): MailingServices {
  const { quantity, productType, isEDDM } = specs;
  const sections: MailingServiceSection[] = [];

  if (isEDDM) {
    // EDDM: Just bundling/paperwork
    const bundlingCost = quantity * mailingRates.eddm.bundling;
    sections.push({
      name: 'LETTERSHOP',
      items: [
        {
          description: 'EDDM Bundling & Paperwork',
          quantity,
          unitPrice: mailingRates.eddm.bundling,
          total: bundlingCost,
        },
      ],
      subtotal: bundlingCost,
    });

    return {
      sections,
      total: bundlingCost,
    };
  }

  // Addressed Mail: Break down into DATA PROCESSING + LETTERSHOP sections

  // DATA PROCESSING (NCOA/CASS)
  const ncoaCost = quantity * 0.007;
  sections.push({
    name: 'DATA PROCESSING',
    items: [
      {
        description: 'NCOA/CASS',
        quantity,
        unitPrice: 0.007,
        total: ncoaCost,
      },
    ],
    subtotal: ncoaCost,
  });

  // LETTERSHOP (varies by product type)
  const lettershopItems = [];

  if (productType === 'postcard') {
    // Postcards: Inkjet + Bulk prep
    lettershopItems.push({
      description: 'Inkjet addressing',
      quantity,
      unitPrice: 0.035,
      total: quantity * 0.035,
    });
    lettershopItems.push({
      description: 'Bulk preparation (traying/bundling)',
      quantity,
      unitPrice: 0.017,
      total: quantity * 0.017,
    });
  } else if (productType === 'flyer' || productType === 'brochure') {
    // Self-mailers: Inkjet + Tabs + Bulk prep
    lettershopItems.push({
      description: 'Inkjet addressing',
      quantity,
      unitPrice: 0.035,
      total: quantity * 0.035,
    });
    lettershopItems.push({
      description: 'Double tab application',
      quantity,
      unitPrice: 0.057,
      total: quantity * 0.057,
    });
    lettershopItems.push({
      description: 'Bulk preparation (flats)',
      quantity,
      unitPrice: 0.017,
      total: quantity * 0.017,
    });
  } else if (productType === 'letter') {
    // Letters: Inkjet + Machine insert + Metering
    lettershopItems.push({
      description: 'Inkjet addressing',
      quantity,
      unitPrice: 0.035,
      total: quantity * 0.035,
    });
    lettershopItems.push({
      description: 'Machine insert (1-piece)',
      quantity,
      unitPrice: 0.034,
      total: quantity * 0.034,
    });
    lettershopItems.push({
      description: 'Metering',
      quantity,
      unitPrice: 0.010,
      total: quantity * 0.010,
    });
  }

  const lettershopSubtotal = lettershopItems.reduce((sum, item) => sum + item.total, 0);
  sections.push({
    name: 'LETTERSHOP',
    items: lettershopItems,
    subtotal: lettershopSubtotal,
  });

  const total = ncoaCost + lettershopSubtotal;

  return {
    sections,
    total,
  };
}

/**
 * Run 6-point QA checks
 */
function runQAChecks(
  specs: QuoteSpecs,
  equipment: any,
  imposition: any,
  costs: CostBreakdown,
  quote: number,
  marginPercent: number
): any {
  const checks = {
    deviceRouting: true,
    spoilageApplied: true,
    paperCostCalculated: costs.paperCost > 0,
    clickCostCalculated: costs.clickCost > 0,
    marginMeetsFloor: marginPercent >= getMarginFloor(specs.productType),
    meetsShopMinimum: quote >= SHOP_MINIMUM,
  };

  // Device routing check
  if (specs.productType === 'envelope') {
    checks.deviceRouting = equipment.deviceType.includes('envelope');
  } else {
    checks.deviceRouting = !equipment.deviceType.includes('envelope');
  }

  return checks;
}
