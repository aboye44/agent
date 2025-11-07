import { PaperStock } from '../types/quote';

// All MPA paper stocks - edit prices here in one place
export const paperStocks: Record<string, PaperStock> = {
  // LETTER/COPY PAPER (for 8.5x11 letters)
  williamsburg60: {
    name: 'Williamsburg 60# Smooth',
    sku: '63352',
    sheetSize: [8.5, 11],
    costPerSheet: 0.0125,
    category: 'letter',
  },
  williamsburg60Alt: {
    name: 'Williamsburg 60# Smooth',
    sku: '10003756',
    sheetSize: [8.5, 11],
    costPerSheet: 0.0126,
    category: 'letter',
  },
  lettermark24: {
    name: 'Lettermark 24# Bond',
    sku: '67041',
    sheetSize: [8.5, 11],
    costPerSheet: 0.01253,
    category: 'letter',
  },

  // TEXT STOCKS (for booklet interiors and premium letters)
  endurance80Gloss: {
    name: 'Endurance 80# Gloss Text',
    sku: '10735824',
    sheetSize: [13, 19],
    costPerSheet: 0.0408,
    category: 'text',
  },
  endurance100Gloss: {
    name: 'Endurance 100# Gloss Text',
    sku: '10735823',
    sheetSize: [13, 19],
    costPerSheet: 0.0505,
    category: 'text',
  },
  endurance100Silk: {
    name: 'Endurance 100# Silk Text',
    sku: '10735917',
    sheetSize: [13, 19],
    costPerSheet: 0.0505,
    category: 'text',
  },
  endurance80Silk: {
    name: 'Endurance 80# Silk Text',
    sku: '10735918',
    sheetSize: [13, 19],
    costPerSheet: 0.0408,
    category: 'text',
  },
  accent70: {
    name: 'Accent 70# Smooth',
    sku: '10724354',
    sheetSize: [12, 18],
    costPerSheet: 0.03998,
    category: 'text',
  },
  accent80: {
    name: 'Accent 80# Smooth',
    sku: '68554',
    sheetSize: [12, 18],
    costPerSheet: 0.04569,
    category: 'text',
  },

  // COVER STOCKS (for postcards, flyers, booklet covers)
  endurance100Cover: {
    name: 'Endurance 100# Gloss Cover',
    sku: '10735784',
    sheetSize: [19, 13],
    costPerSheet: 0.0965,
    category: 'cover',
  },
  kallima14pt: {
    name: 'Kallima 14pt C2S',
    sku: '1.10594E+11',
    sheetSize: [19, 13],
    costPerSheet: 0.123,
    category: 'cover',
  },
  endurance130Silk: {
    name: 'Endurance 130# Silk Cover',
    sku: '20033067',
    sheetSize: [28, 40],
    costPerSheet: 0.1331,
    category: 'cover',
  },
  endurance80SilkCover: {
    name: 'Endurance 80# Silk Cover',
    sku: '10911756',
    sheetSize: [19, 13],
    costPerSheet: 0.0772,
    category: 'cover',
  },
  accent100Cover: {
    name: 'Accent 100# Smooth Cover',
    sku: '68574',
    sheetSize: [19, 13],
    costPerSheet: 0.1232,
    category: 'cover',
  },
  accent80Cover: {
    name: 'Accent 80# Smooth Cover',
    sku: '68573',
    sheetSize: [19, 13],
    costPerSheet: 0.0951,
    category: 'cover',
  },
  accent120Cover: {
    name: 'Accent 120# Smooth Cover',
    sku: '68666',
    sheetSize: [19, 13],
    costPerSheet: 0.1787,
    category: 'cover',
  },

  // ENVELOPES
  seville24_10: {
    name: 'Seville 24# #10',
    sku: '10766056',
    sheetSize: [9.5, 4.125],
    costPerSheet: 0.0242,
    category: 'envelope',
  },
  mac24_10: {
    name: 'MAC 24# #10',
    sku: '083440N',
    sheetSize: [9.5, 4.125],
    costPerSheet: 0.02321,
    category: 'envelope',
  },
  seville24_9: {
    name: 'Seville 24# #9',
    sku: '10766047',
    sheetSize: [8.875, 3.875],
    costPerSheet: 0.02384,
    category: 'envelope',
  },
  seville24_6x9: {
    name: 'Seville 24# 6×9 Booklet',
    sku: '20001992',
    sheetSize: [9, 6],
    costPerSheet: 0.027,
    category: 'envelope',
  },
};

// Stock defaults by product type
export const defaultStocks = {
  letter: 'williamsburg60',
  postcard: 'kallima14pt',
  flyer: 'endurance100Gloss', // 13x19 for 2-up imposition
  brochure: 'endurance100Gloss',
  bookletCover: 'endurance100Cover',
  bookletText: 'endurance100Gloss',
  envelope: 'seville24_10',
};

// Stock conversion table (for parsing user input)
export const stockAliases: Record<string, string> = {
  '14pt': 'kallima14pt',
  '14pt cover': 'kallima14pt',
  'kallima': 'kallima14pt',
  '100# gloss': 'endurance100Gloss',
  '100# gloss cover': 'endurance100Cover',
  '100# gloss text': 'endurance100Gloss',
  '80# gloss': 'endurance80Gloss',
  '100# silk': 'endurance100Silk',
  '80# silk': 'endurance80Silk',
  '130# silk': 'endurance130Silk',
  'endurance': 'endurance100Gloss',
  'williamsburg': 'williamsburg60',
  '60# white': 'williamsburg60',
  'seville': 'seville24_10',
};
