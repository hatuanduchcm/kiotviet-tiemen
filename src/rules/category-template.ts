/**
 * Central category template used across rules.
 * Editable list of category keys, code prefixes and name keywords.
 */
const CATEGORY_TEMPLATE: Array<{
  key: 'SUIT' | 'JACKET' | 'MANTO' | 'GILE' | 'QUAN' | 'SOMI';
  prefixes?: string[];
  nameKeywords?: string[];
}> = [
  { key: 'SUIT', prefixes: ['BS'], nameKeywords: ['BỘ SUIT', 'SUIT'] },
  { key: 'JACKET', prefixes: ['AJ'], nameKeywords: ['ÁO JACKET', 'JACKET'] },
  { key: 'MANTO', prefixes: ['MT'], nameKeywords: ['MĂNG TÔ', 'MANTO'] },
  { key: 'GILE', prefixes: ['AG'], nameKeywords: ['GILE', 'GILET', 'ÁO GILE'] },
  { key: 'QUAN', prefixes: ['QT'], nameKeywords: ['QUẦN', 'PANTS'] },
  { key: 'SOMI', prefixes: ['SM', 'ASM'], nameKeywords: ['SƠ MI', 'SOMI'] }
];

export { CATEGORY_TEMPLATE };
export default CATEGORY_TEMPLATE;
