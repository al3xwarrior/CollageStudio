export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
