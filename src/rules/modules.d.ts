// Ambient module declarations to help TS resolve relative .js imports from this folder
declare module './filter-columns-kiotviet.js' {
  export const COLUMNS_TO_KEEP: string[];
  export function filterColumnsKiotViet(rows: any[]): any[];
}

declare module './split-bosuit-to-jacket-pants.js' {
  export function splitBoSuitToJacketPants(rows: any[]): any[];
}

declare module './merge-canvas-to-jacket-manto.js' {
  export function mergeCanvasToJacketManto(rows: any[]): any[];
}

declare module './common.js' {
  export function normalizeProductName(name: any): string;
  export function hasPrefix(code: any, prefix: any): boolean;
  export function nameIncludes(name: any, keyword: any): boolean;
  export function parseNumber(val: any): number;
}

export {};
