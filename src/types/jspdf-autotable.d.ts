// Type declarations for jspdf-autotable
declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';

  interface ColumnStyles {
    [key: number]: {
      cellWidth?: number;
      halign?: 'left' | 'center' | 'right';
      valign?: 'top' | 'middle' | 'bottom';
      fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
      fillColor?: string | number[];
      textColor?: string | number[];
      fontSize?: number;
    };
  }

  interface UserOptions {
    startY?: number;
    head?: any[][];
    body?: any[][];
    theme?: 'striped' | 'grid' | 'plain';
    headStyles?: any;
    bodyStyles?: any;
    columnStyles?: ColumnStyles;
    didParseCell?: (data: any) => void;
    margin?: { top?: number; right?: number; bottom?: number; left?: number };
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): jsPDF;
}
