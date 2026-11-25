import { PublicKey } from "@solana/web3.js";

/**
 * Сокращение адреса для отображения (e.g. "CnBm...qkP")
 */
export function shortenAddress(address: string | PublicKey | null | undefined, chars = 4): string {
  if (!address) return "";
  const str = typeof address === "string" ? address : address.toBase58();
  if (str.length <= chars * 2 + 3) return str;
  return `${str.slice(0, chars)}...${str.slice(-chars)}`;
}

/**
 * Форматирование суммы с учётом decimals для UI (e.g. 1500000 -> "1.50")
 */
export function formatUnits(
  amount: bigint | number | string,
  decimals = 6,
  maxFractionDigits = 4
): string {
  try {
    const bigVal = typeof amount === "bigint" ? amount : BigInt(Math.floor(Number(amount)));
    const negative = bigVal < 0n;
    const absVal = negative ? -bigVal : bigVal;

    const divisor = 10n ** BigInt(decimals);
    const integerPart = absVal / divisor;
    const remainder = absVal % divisor;

    let remainderStr = remainder.toString().padStart(decimals, "0");
    remainderStr = remainderStr.slice(0, maxFractionDigits);

    // Убираем хвостовые нули после точки
    remainderStr = remainderStr.replace(/0+$/, "");

    const sign = negative ? "-" : "";
    const intFormatted = integerPart.toLocaleString("ru-RU");

    return remainderStr.length > 0 ? `${sign}${intFormatted}.${remainderStr}` : `${sign}${intFormatted}`;
  } catch {
    return "0";
  }
}

/**
 * Безопасный парсинг пользовательского строкового ввода в bigint с учётом decimals.
 * Поддерживает как запятую, так и точку в качестве разделителя.
 */
export function parseUnits(amountStr: string, decimals = 6): bigint {
  if (!amountStr || typeof amountStr !== "string") return 0n;
  const sanitized = amountStr.trim().replace(",", ".");
  if (!sanitized || isNaN(Number(sanitized)) || Number(sanitized) < 0) return 0n;

  const [intPart, fracPart = ""] = sanitized.split(".");
  const cleanInt = intPart.replace(/[^0-9]/g, "") || "0";
  const cleanFrac = fracPart.replace(/[^0-9]/g, "");

  const truncatedFrac = cleanFrac.slice(0, decimals).padEnd(decimals, "0");

  return BigInt(cleanInt) * 10n ** BigInt(decimals) + BigInt(truncatedFrac);
}

/**
 * Маппинг Anchor/Solana/Wallet ошибок в понятные сообщения на русском языке.
 */
export function formatError(err: any): string {
  if (!err) return "Неизвестная ошибка";
  const message = err.message || String(err);

  if (message.includes("User rejected") || message.includes("rejected the request")) {
    return "Транзакция отклонена пользователем в кошельке.";
  }
  if (message.includes("InsufficientFunds") || message.includes("6000") || message.includes("0x1770")) {
    return "Недостаточно средств в хранилище Vault для завершения операции.";
  }
  if (message.includes("InvalidPoolMints") || message.includes("6001") || message.includes("0x1771")) {
    return "Токены пула не совпадают со сконфигурированными минтами хранилища.";
  }
  if (message.includes("UnauthorizedPool") || message.includes("6002") || message.includes("0x1772")) {
    return "Неавторизованный пул: пул не соответствует настроенному маршруту.";
  }
  if (message.includes("ZeroSwapAmount") || message.includes("6003") || message.includes("0x1773")) {
    return "Сумма операции должна быть строго больше нуля.";
  }
  if (message.includes("SlippageExceeded") || message.includes("6004") || message.includes("0x1774")) {
    return "Превышен лимит проскальзывания (Slippage Exceeded). Попробуйте позже.";
  }
  if (message.includes("InvalidTreasuryAccount") || message.includes("6005") || message.includes("0x1775")) {
    return "Указанный токен-аккаунт не принадлежит казначейству Vault.";
  }
  if (message.includes("PoolMismatch") || message.includes("6006") || message.includes("0x1776")) {
    return "Пул не соответствует зарегистрированному маршруту обмена.";
  }
  if (message.includes("InvalidTickRange") || message.includes("6007") || message.includes("0x1777")) {
    return "Невалидный ценовой диапазон: нижний тик должен быть меньше верхнего.";
  }
  if (message.includes("EmptyPosition") || message.includes("6008") || message.includes("0x1778")) {
    return "Позиция не найдена или пуста.";
  }
  if (message.includes("ConstraintHasOne") || message.includes("2001") || message.includes("0x7d1")) {
    return "Ошибка доступа: действие доступно только администратору хранилища.";
  }
  if (message.includes("ConstraintSeeds") || message.includes("2006") || message.includes("0x7d6")) {
    return "Некорректные seeds или несоответствие владельца PDA.";
  }
  if (message.includes("TooLittleOutputReceived") || message.includes("6018")) {
    return "Рыночная цена изменилась: сработала защита от проскальзывания пула (6018).";
  }
  if (message.includes("insufficient lamports")) {
    return "Недостаточно SOL на балансе кошелька для оплаты комиссии сети Devnet.";
  }
  if (message.includes("Account does not exist") || message.includes("could not find account")) {
    return "Ончейн-аккаунт ещё не инициализирован. Сначала создайте карточку.";
  }

  // Обрезка слишком длинных логов
  return message.length > 150 ? `${message.slice(0, 150)}...` : message;
}
