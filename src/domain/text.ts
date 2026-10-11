/**
 * NHR
 * @author Nahid Hasan Rayan
 */

const TAB = 9;
const NEWLINE = 10;
const DELETE = 127;

function isControl(code: number): boolean {
  return code < 32 || code === DELETE;
}

export function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    if (isControl(value.charCodeAt(index))) {
      return true;
    }
  }
  return false;
}

export function stripControlCharacters(value: string, keepWhitespace = false): string {
  let result = "";
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    const keep = keepWhitespace && (code === TAB || code === NEWLINE);
    if (!isControl(code) || keep) {
      result += value[index];
    }
  }
  return result;
}
