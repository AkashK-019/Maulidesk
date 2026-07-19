/**
 * Formats a numeric value as currency in Indian Rupees (INR) format.
 * @param {number} amount - Value to format
 * @returns {string} - Formatted currency (e.g. ₹1,50,000.00)
 */
export function formatCurrency(amount) {
  if (amount === undefined || amount === null || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * @param {string|Date} dateStr - Date object or date string
 * @returns {string} - Formatted date (e.g., Jun 11, 2026)
 */
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * @param {number} amount - Base amount
 * @param {string} clientState - State of the client
 * @param {string} companyState - State of the company (defaults to Maharashtra)
 * @param {number} [percent=18] - Total GST percentage
 * @returns {object} - Object containing GST values
 */
export function calculateGST(amount, clientState = 'Maharashtra', companyState = 'Maharashtra', percent = 18) {
  const base = parseFloat(amount) || 0;
  const pct = parseFloat(percent) || 0;
  const gstAmount = (base * pct) / 100;
  
  const isSameState = clientState.toLowerCase().trim() === companyState.toLowerCase().trim();
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let gstType = 'IGST';

  if (isSameState) {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
    gstType = 'CGST_SGST';
  } else {
    igst = gstAmount;
    gstType = 'IGST';
  }

  return {
    base,
    gstPercent: pct,
    gstAmount,
    cgst,
    sgst,
    igst,
    gstType,
    total: base + gstAmount
  };
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 
  'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 
  'Ladakh', 'Lakshadweep', 'Puducherry'
];
