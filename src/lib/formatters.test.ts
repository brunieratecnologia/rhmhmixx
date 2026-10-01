import { describe, it, expect } from 'vitest'
import { toDateInputValue, formatBRDate } from './formatters'

describe('formatBRDate', () => {
  it('formata data pura YYYY-MM-DD para DD/MM/AAAA sem deslocamento', () => {
    expect(formatBRDate('2022-02-01')).toBe('01/02/2022')
    expect(formatBRDate('2026-02-02')).toBe('02/02/2026')
    expect(formatBRDate('2026-05-20')).toBe('20/05/2026')
    expect(formatBRDate('1995-03-09')).toBe('09/03/1995')
  })

  it('formata datetime meia-noite UTC (formato PocketBase com espaço ou ISO com T) mantendo a data civil correta', () => {
    // Caso clássico do bug corrigido na v0.0.24: "2022-02-01 00:00:00.000Z" exibia 31/01/2022 por causa do UTC-3
    expect(formatBRDate('2022-02-01 00:00:00.000Z')).toBe('01/02/2022')
    expect(formatBRDate('2026-02-02 00:00:00.000Z')).toBe('02/02/2026')
    expect(formatBRDate('2026-05-20 00:00:00.000Z')).toBe('20/05/2026')
    expect(formatBRDate('1970-10-13 00:00:00.000Z')).toBe('13/10/1970')

    // Padrão ISO 8601 com 'T'
    expect(formatBRDate('2022-02-01T00:00:00.000Z')).toBe('01/02/2022')
    expect(formatBRDate('2026-02-02T00:00:00Z')).toBe('02/02/2026')
  })

  it('preserva strings que já estão no formato brasileiro DD/MM/AAAA', () => {
    expect(formatBRDate('01/02/2022')).toBe('01/02/2022')
    expect(formatBRDate('20/05/2026')).toBe('20/05/2026')
  })

  it('converte timestamp com horário real para o fuso America/Sao_Paulo', () => {
    // "2024-01-01 02:30:00.000Z" em UTC-3 corresponde a 31/12/2023 23:30:00
    expect(formatBRDate('2024-01-01 02:30:00.000Z')).toBe('31/12/2023')
    expect(formatBRDate('2024-01-01T02:30:00Z')).toBe('31/12/2023')
    // "2024-06-15 15:00:00.000Z" em UTC-3 corresponde a 15/06/2024 12:00:00
    expect(formatBRDate('2024-06-15 15:00:00.000Z')).toBe('15/06/2024')
  })

  it('lida com nulos, vazios, espaços e valores inválidos com segurança', () => {
    expect(formatBRDate(null)).toBe('-')
    expect(formatBRDate(undefined)).toBe('-')
    expect(formatBRDate('')).toBe('-')
    expect(formatBRDate('   ')).toBe('-')
    expect(formatBRDate('texto-invalido')).toBe('texto-invalido')
  })
})

describe('toDateInputValue', () => {
  it('extrai YYYY-MM-DD do formato PocketBase com espaço e timezone UTC', () => {
    // Exemplo real vindo do banco PocketBase no RH MHMIXX
    expect(toDateInputValue('1995-03-09 00:00:00.000Z')).toBe('1995-03-09')
    expect(toDateInputValue('2022-02-01 00:00:00.000Z')).toBe('2022-02-01')
    expect(toDateInputValue('1970-10-13 00:00:00.000Z')).toBe('1970-10-13')
  })

  it('extrai YYYY-MM-DD do formato ISO 8601 padrão com T', () => {
    expect(toDateInputValue('1995-03-09T00:00:00.000Z')).toBe('1995-03-09')
    expect(toDateInputValue('2026-05-20T14:30:00Z')).toBe('2026-05-20')
  })

  it('mantém YYYY-MM-DD quando a string já está no formato simples', () => {
    expect(toDateInputValue('1995-03-09')).toBe('1995-03-09')
    expect(toDateInputValue('2022-02-01')).toBe('2022-02-01')
  })

  it('lida com espaços em branco no início ou fim', () => {
    expect(toDateInputValue('  1995-03-09 00:00:00.000Z  ')).toBe('1995-03-09')
    expect(toDateInputValue(' 2026-01-15 ')).toBe('2026-01-15')
  })

  it('retorna string vazia para valores nulos, vazios ou indefinidos', () => {
    expect(toDateInputValue(null)).toBe('')
    expect(toDateInputValue(undefined)).toBe('')
    expect(toDateInputValue('')).toBe('')
    expect(toDateInputValue('   ')).toBe('')
  })

  it('retorna string vazia para formatos inválidos que não começam com YYYY-MM-DD', () => {
    expect(toDateInputValue('09/03/1995')).toBe('')
    expect(toDateInputValue('invalid-date')).toBe('')
    expect(toDateInputValue('12345')).toBe('')
  })
})
