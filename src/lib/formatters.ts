/**
 * Format date string (ISO / YYYY-MM-DD) to Brazilian DD/MM/AAAA
 */
export function formatBRDate(dateStr?: string | null, timeZone = 'America/Sao_Paulo'): string {
  if (!dateStr) return '-'
  try {
    // If it's pure YYYY-MM-DD without time or timezone, format directly without shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const parts = dateStr.split('-')
      return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    // If it's an ISO timestamp (e.g. UTC timestamp_utc with T or Z), format in America/Sao_Paulo
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d)
  } catch {
    return dateStr || '-'
  }
}

/**
 * Format time HH:mm
 */
export function formatBRTime(dateStr?: string | null, timeZone = 'America/Sao_Paulo'): string {
  if (!dateStr) return '--:--'
  try {
    // If it's already a plain time string (HH:MM or HH:MM:SS) without date or timezone info
    if (
      dateStr.includes(':') &&
      dateStr.length <= 8 &&
      !dateStr.includes('T') &&
      !dateStr.includes('Z')
    ) {
      return dateStr.slice(0, 5)
    }
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return '--:--'
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return '--:--'
  }
}

/**
 * Format time with seconds (HH:mm:ss) in America/Sao_Paulo timezone
 */
export function formatBRTimeWithSeconds(
  dateStr?: string | Date | null,
  timeZone = 'America/Sao_Paulo',
): string {
  if (!dateStr) return '--:--:--'
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(d.getTime())) return '--:--:--'
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return '--:--:--'
  }
}

/**
 * Retorna partes do horário oficial de São Paulo ({ hours, minutes, seconds, shortDate, longDate })
 * a partir de uma data ou timestamp UTC, garantindo fuso America/Sao_Paulo (UTC-3)
 */
export function getSPDateTimeParts(
  date: Date = new Date(),
  timeZone = 'America/Sao_Paulo',
): {
  hours: string
  minutes: string
  seconds: string
  shortDate: string
  longDate: string
} {
  try {
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const timeParts = timeFormatter.formatToParts(date)
    const hours = timeParts.find((p) => p.type === 'hour')?.value || '00'
    const minutes = timeParts.find((p) => p.type === 'minute')?.value || '00'
    const seconds = timeParts.find((p) => p.type === 'second')?.value || '00'

    const longDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date)

    const shortDate = new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)

    return { hours, minutes, seconds, shortDate, longDate }
  } catch {
    return {
      hours: String(date.getHours()).padStart(2, '0'),
      minutes: String(date.getMinutes()).padStart(2, '0'),
      seconds: String(date.getSeconds()).padStart(2, '0'),
      shortDate: '--/--/----',
      longDate: '',
    }
  }
}

/**
 * Format currency to R$ 0.000,00
 */
export function formatBRCurrency(value?: number | null): string {
  if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/**
 * Apply CPF mask XXX.XXX.XXX-XX
 */
export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/**
 * Apply CNPJ mask XX.XXX.XXX/XXXX-XX
 */
export function maskCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/**
 * Apply Phone mask (XX) XXXXX-XXXX or (XX) XXXX-XXXX
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2')
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2')
}

/**
 * Strip non-digit characters
 */
export function cleanDigits(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Standard CPF validation algorithm
 */
export function isValidCPF(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '')
  if (clean.length !== 11) return false
  // Block common repeats
  if (/^(\d)\1{10}$/.test(clean)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(clean.charAt(i), 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(clean.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(clean.charAt(i), 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(clean.charAt(10), 10)) return false

  return true
}
