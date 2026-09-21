/**
 * Utilitários para tratamento de datas e calendário considerando o fuso America/Sao_Paulo
 */

export function getSaoPauloDateParts(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d); // "YYYY-MM-DD"
  const [year, month, day] = parts.split("-").map(Number);
  return { year, month, day };
}

/**
 * Retorna o intervalo da semana (Segunda-feira 00:00:00 até Domingo 23:59:59.999)
 * no fuso horário America/Sao_Paulo para uma determinada data.
 */
export function getWeekBoundsInSaoPaulo(d: Date): { startOfWeek: Date; endOfWeek: Date } {
  const { year, month, day } = getSaoPauloDateParts(d);

  // Calcula o dia da semana considerando a data local
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = dt.getUTCDay(); // 0 = Domingo, 1 = Segunda ... 6 = Sábado

  // Segunda-feira é 1. Se for Domingo (0), a diferença para Segunda é -6 dias. Caso contrário, 1 - dayOfWeek.
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const mondayUtc = new Date(Date.UTC(year, month - 1, day + diffToMonday));
  const sundayUtc = new Date(Date.UTC(year, month - 1, day + diffToMonday + 6));

  const mondayStr = `${mondayUtc.getUTCFullYear()}-${String(mondayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(mondayUtc.getUTCDate()).padStart(2, "0")}T00:00:00.000-03:00`;
  const sundayStr = `${sundayUtc.getUTCFullYear()}-${String(sundayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(sundayUtc.getUTCDate()).padStart(2, "0")}T23:59:59.999-03:00`;

  return {
    startOfWeek: new Date(mondayStr),
    endOfWeek: new Date(sundayStr),
  };
}

/**
 * Converte string de data no formato YYYY-MM-DD considerando o fuso America/Sao_Paulo
 */
export function parseDateInSaoPaulo(dateStr: string, isEndOfDay = false): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const timePart = isEndOfDay ? "23:59:59.999-03:00" : "00:00:00.000-03:00";
    return new Date(`${dateStr}T${timePart}`);
  }
  return new Date(dateStr);
}

