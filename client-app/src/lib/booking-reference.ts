/**
 * Booking references are `GBX-` plus ten random alphanumerics, e.g. GBX-7K2M9Q4T1B.
 * The database default (`public.new_booking_reference()`) uses the same alphabet,
 * so a reference looks the same whether the server or the device made it.
 */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 10;

export function newBookingReference(): string {
  let code = '';
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `GBX-${code}`;
}
