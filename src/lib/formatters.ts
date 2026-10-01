/**
 * Format date string (ISO / YYYY-MM-DD) to Brazilian DD/MM/AAAA
 */
export function formatBRDate(dateStr?: string | null, timeZone = 'America/Sao_Paulo'): string {
  if (!dateStr) return '-'
  const trimmed = dateStr.trim()
  if (!trimmed) return '-'

  try {
    // 1. Data civil: se contiver formato YYYY-MM-DD (com ou sem meia-noite 00:00:00.000Z/T00:00:00Z)
    // Extrai ano, mês e dia diretamente para evitar que o fuso local (UTC-3) desloque para o dia anterior
    const ymdMatch = trimmed.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/,
    )
    if (ymdMatch) {
      const [, y, m, d, hh, mm, ss] = ymdMatch
      // Se não tiver hora ou for meia-noite exata (ex.: 00:00:00.000Z gravada pelo PocketBase para campos date),
      // trata como data civil pura (sem hora) para não voltar 1 dia
      const isMidnightOrDateOnly =
        hh === undefined ||
        (hh === '00' && (mm === '00' || mm === undefined) && (ss === '00' || ss === undefined))

      if (isMidnightOrDateOnly) {
        return `${d}/${m}/${y}`
      }
    }

    // 2. Se já estiver no padrão brasileiro DD/MM/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
      return trimmed
    }

    // 3. Se for timestamp com hora efetiva (ex.: batidas de ponto, logs, created/updated), converte com fuso oficial
    const parsedDate = new Date(trimmed)
    if (isNaN(parsedDate.getTime())) return trimmed

    return new Intl.DateTimeFormat('pt-BR', {
      timeZone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(parsedDate)
  } catch {
    return trimmed || '-'
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

/**
 * Deriva PIN padrão de 6 dígitos a partir da data de nascimento (DDMMAA).
 * Exemplo: 13/10/1970 ou 1970-10-13 -> "131070"
 */
/**
 * Extrai YYYY-MM-DD para preenchimento de <input type="date">.
 * Suporta formatos retornados pelo PocketBase ("1995-03-09 00:00:00.000Z"),
 * ISO 8601 ("1995-03-09T00:00:00.000Z") e strings já simples ("1995-03-09").
 * Retorna string vazia se inválido ou nulo.
 */
export function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return ''
  const trimmed = dateStr.trim()
  const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) {
    return match[1]
  }
  return ''
}

export function derivarPinDataNascimento(dataNascimento: string | null | undefined): string {
  if (!dataNascimento) return ''
  const dateOnly = dataNascimento.split('T')[0].trim()
  if (!dateOnly) return ''

  // Caso esteja no formato YYYY-MM-DD
  if (dateOnly.includes('-')) {
    const parts = dateOnly.split('-')
    if (parts.length >= 3) {
      const [yyyy, mm, dd] = parts
      const aa = yyyy.slice(-2)
      const pin = `${dd.padStart(2, '0')}${mm.padStart(2, '0')}${aa.padStart(2, '0')}`
      return /^\d{6}$/.test(pin) ? pin : ''
    }
  }

  // Caso esteja no formato DD/MM/YYYY
  if (dateOnly.includes('/')) {
    const parts = dateOnly.split('/')
    if (parts.length >= 3) {
      const [dd, mm, yyyy] = parts
      const aa = yyyy.slice(-2)
      const pin = `${dd.padStart(2, '0')}${mm.padStart(2, '0')}${aa.padStart(2, '0')}`
      return /^\d{6}$/.test(pin) ? pin : ''
    }
  }

  return ''
}

/**
 * Calcula a próxima matrícula sequencial com base nas matrículas existentes.
 * Preserva o padding de zeros à esquerda (ex.: se a maior for "002", sugere "003").
 */
export function calcularProximaMatricula(matriculasExistentes: string[]): string {
  if (!matriculasExistentes || matriculasExistentes.length === 0) {
    return '001'
  }

  let maxNum = 0
  let maxLen = 3

  for (const m of matriculasExistentes) {
    if (!m) continue
    const trimmed = m.trim()
    const match = trimmed.match(/\d+/)
    if (match) {
      const num = parseInt(match[0], 10)
      if (!isNaN(num)) {
        if (num > maxNum) {
          maxNum = num
          maxLen = Math.max(match[0].length, 3)
        }
      }
    }
  }

  const nextNum = maxNum + 1
  return String(nextNum).padStart(maxLen, '0')
}
