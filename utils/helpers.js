/**
 * Robust value clipping
 * @param {number} val 
 * @param {number} min 
 * @param {number} max 
 * @returns {number}
 */
export function clip(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/**
 * Common currency formatter (EUR, no decimals)
 * @param {number} v 
 * @returns {string}
 */
export const fmtCurrency = (v) => new Intl.NumberFormat('de-DE', { 
    style: 'currency', 
    currency: 'EUR', 
    maximumFractionDigits: 0 
}).format(v);

/**
 * CSV specific number formatter (Excel friendly 1234,56)
 * @param {number} num 
 * @returns {string}
 */
export const fmtCSV = (num) => Number(num).toFixed(2).replace('.', ',');
