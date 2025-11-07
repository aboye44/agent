import { Equipment } from '../types/quote';

// All MPA equipment with click rates
export const equipment: Record<string, Equipment> = {
  iridesse: {
    name: 'P-01 Iridesse Color',
    clickRate: 0.0416,
    deviceType: 'color',
  },
  nuvera: {
    name: 'P-06 Nuvera B&W',
    clickRate: 0.0027,
    deviceType: 'bw',
  },
  versantColor: {
    name: 'P-04 Versant Color Envelope',
    clickRate: 0.0336,
    deviceType: 'envelope-color',
  },
  versantBW: {
    name: 'P-05 Versant B&W Envelope',
    clickRate: 0.0080,
    deviceType: 'envelope-bw',
  },
};

// Device routing rules
export function getEquipment(productType: string, color: string): Equipment {
  // Envelopes must use Versant
  if (productType === 'envelope') {
    return color === '4/4' || color === '4/0'
      ? equipment.versantColor
      : equipment.versantBW;
  }

  // B&W work uses Nuvera
  if (color === '1/0' || color === '1/1') {
    return equipment.nuvera;
  }

  // Color work uses Iridesse
  return equipment.iridesse;
}
