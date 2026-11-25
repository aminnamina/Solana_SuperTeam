/**
 * Точные математические расчёты для Vault и Shares.
 * Работает строго через bigint, исключая потери точности IEEE 754 float.
 */

export const PRECISION = 1_000_000n; // 1e6 (6 decimals)

/**
 * Расчёт стоимости 1 share в базовом токене.
 * Если shares ещё не выпущены (первый депозит), курс = 1.0.
 */
export function getShareRate(
  totalAssets: bigint,
  totalShares: bigint,
  precision: bigint = PRECISION
): number {
  if (totalShares <= 0n || totalAssets <= 0n) {
    return 1.0;
  }
  const rateScaled = (totalAssets * precision) / totalShares;
  return Number(rateScaled) / Number(precision);
}

/**
 * Предпросмотр получаемых shares при депозите базовых токенов.
 * Формула:
 *   shares = (depositAmount * totalShares) / totalAssets
 * Для первого депозита (или при totalShares == 0):
 *   shares = depositAmount
 */
export function previewDeposit(
  depositAmount: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  if (depositAmount <= 0n) return 0n;
  if (totalShares <= 0n || totalAssets <= 0n) {
    return depositAmount;
  }
  return (depositAmount * totalShares) / totalAssets;
}

/**
 * Предпросмотр возвращаемых базовых токенов при выводе shares.
 * Формула:
 *   assets = (sharesAmount * totalAssets) / totalShares
 */
export function previewWithdraw(
  sharesAmount: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  if (sharesAmount <= 0n || totalShares <= 0n) return 0n;
  const assets = (sharesAmount * totalAssets) / totalShares;
  return assets > totalAssets ? totalAssets : assets;
}

/**
 * Оценка стоимости shares пользователя в базовых токенах.
 */
export function evaluateUserPosition(
  userShares: bigint,
  totalAssets: bigint,
  totalShares: bigint
): bigint {
  return previewWithdraw(userShares, totalAssets, totalShares);
}
