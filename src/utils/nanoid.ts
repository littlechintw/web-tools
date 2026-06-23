// Minimal, dependency-free NanoID using the Web Crypto CSPRNG.
// Same default 64-char URL-safe alphabet as the `nanoid` package.
const ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'

export function nanoid(size = 21): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size))
  let id = ''
  for (let i = 0; i < size; i++) {
    // 6 bits per char; alphabet length is 64 so no modulo bias.
    id += ALPHABET[bytes[i] & 63]
  }
  return id
}
