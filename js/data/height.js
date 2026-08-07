export const MIN_VALID_HEIGHT_CM = 140;
export const MAX_VALID_HEIGHT_CM = 220;

export function isValidHeightCm(value) {
  return Number.isInteger(value)
    && value >= MIN_VALID_HEIGHT_CM
    && value <= MAX_VALID_HEIGHT_CM;
}

export function normaliseHeightCm(value, normaliseNumber = Number) {
  const numeric = normaliseNumber(value);
  return isValidHeightCm(numeric) ? numeric : null;
}
