/**
 * Bangladeshi mobile numbers. Customers are identified by their verified phone, always stored in
 * one form: 01XXXXXXXXX (11 digits, operator prefix 013–019).
 *
 *   normalisePhone("+880 1712-345678") → "01712345678"
 *   normalisePhone("8801712345678")    → "01712345678"
 *   normalisePhone("1712345678")       → "01712345678"
 *   normalisePhone("02 9876543")       → null (a landline)
 */
export function normalisePhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("880")) d = d.slice(3);
  if (d.length === 10 && d.startsWith("1")) d = `0${d}`;
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

/** 01712345678 → "01712-345678", easier to read back */
export const formatPhone = (phone: string) =>
  /^\d{11}$/.test(phone) ? `${phone.slice(0, 5)}-${phone.slice(5)}` : phone;

/** 01712345678 → 8801712345678, the form SMS gateways expect */
export const internationalPhone = (phone: string) => `88${phone}`;
