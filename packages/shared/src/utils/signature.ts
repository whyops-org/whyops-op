// Zero-width characters for binary encoding
const ZERO_WIDTH_START = '\u200B'; // Zero Width Space
const ZERO_WIDTH_ONE = '\u200C';   // Zero Width Non-Joiner
const ZERO_WIDTH_ZERO = '\u200D';  // Zero Width Joiner
const ZERO_WIDTH_END = '\u200E';   // Left-To-Right Mark (as end delimiter)

/**
 * Encodes a UUID string into a sequence of zero-width characters.
 * This allows hiding the ID within text content invisible to humans.
 */
export function encodeSignature(id: string): string {
  let binary = '';
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i);
    const bin = code.toString(2).padStart(8, '0'); // 8-bit binary
    binary += bin;
  }

  // Map binary to zero-width chars
  let signature = ZERO_WIDTH_START;
  for (let i = 0; i < binary.length; i++) {
    signature += binary[i] === '1' ? ZERO_WIDTH_ONE : ZERO_WIDTH_ZERO;
  }
  signature += ZERO_WIDTH_END;

  return signature;
}

/**
 * Extracts a hidden UUID signature from a string.
 * Returns the found ID or null.
 */
export function decodeSignature(text: string): string | null {
  if (!text) return null;

  const regex = new RegExp(`${ZERO_WIDTH_START}([${ZERO_WIDTH_ONE}${ZERO_WIDTH_ZERO}]+)${ZERO_WIDTH_END}`);
  const match = text.match(regex);

  if (!match) return null;

  const binaryString = match[1];
  let id = '';

  // Decode binary to string (8 bits per char)
  for (let i = 0; i < binaryString.length; i += 8) {
    const byte = binaryString.substring(i, i + 8);
    let charCode = 0;
    for (let j = 0; j < 8; j++) {
      if (byte[j] === ZERO_WIDTH_ONE) { // Map back from custom char
        charCode |= 1 << (7 - j);
      }
    }
    id += String.fromCharCode(charCode);
  }

  return id;
}

/**
 * Removes the hidden signature from the text to ensure 
 * the LLM receives clean input.
 */
export function stripSignature(text: string): string {
  if (!text) return text;
  // Regex to remove the entire block including delimiters
  const regex = new RegExp(`${ZERO_WIDTH_START}[${ZERO_WIDTH_ONE}${ZERO_WIDTH_ZERO}]+${ZERO_WIDTH_END}`, 'g');
  return text.replace(regex, '');
}
