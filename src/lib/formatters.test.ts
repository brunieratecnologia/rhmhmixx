import { describe, it, expect } from 'vitest'
import { toDateInputValue } from './formatters'

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
