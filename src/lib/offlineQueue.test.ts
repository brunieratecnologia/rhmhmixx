import { describe, it, expect, beforeEach } from 'vitest'
import {
  computePinHash,
  salvarCacheFuncionarios,
  carregarCacheFuncionarios,
  enfileirarBatidaOffline,
  carregarFilaOffline,
  removerBatidaOffline,
  salvarFilaOffline,
  validarPinOffline,
  type FuncionarioCacheOffline,
  type BatidaOfflineFila,
  PIN_SALT,
} from './offlineQueue'
import { calcularHorasRealizadas } from './calculoHoras'
import type { RegistroHorario } from '@/types/rh'

describe('Modo Offline do Terminal de Ponto MH MIXX', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('calcula hash SHA-256 do PIN compatível com o backend', async () => {
    const pin = '1234'
    const hash = await computePinHash(pin, PIN_SALT)
    expect(hash).toBeDefined()
    expect(hash.length).toBe(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)

    // Mesma entrada deve gerar hash idêntico (determinístico)
    const hashRepetido = await computePinHash(pin, PIN_SALT)
    expect(hashRepetido).toBe(hash)
  })

  it('salva e recupera cache local de funcionários ativos', () => {
    const funcs: FuncionarioCacheOffline[] = [
      {
        id: 'func_001',
        nome: 'Ailton Cassiano',
        matricula: '002',
        pin_hash: 'hash_ailton',
      },
      {
        id: 'func_002',
        nome: 'Gabriel Willian',
        matricula: '003',
        pin_hash: 'hash_gabriel',
      },
    ]

    salvarCacheFuncionarios(funcs)
    const carregados = carregarCacheFuncionarios()
    expect(carregados).toHaveLength(2)
    expect(carregados[0].nome).toBe('Ailton Cassiano')
    expect(carregados[1].matricula).toBe('003')
  })

  it('retorna erro amigável se tentar validar offline antes da primeira sincronização (sem cache)', async () => {
    const res = await validarPinOffline('1234', Date.now())
    expect(res.valido).toBe(false)
    expect(res.mensagemErro).toContain('conectar à internet uma vez')
  })

  it('valida PIN localmente com sucesso quando existe no cache', async () => {
    const pin = '5678'
    const pinHash = await computePinHash(pin, PIN_SALT)

    salvarCacheFuncionarios([
      {
        id: 'func_teste',
        nome: 'Colaborador Teste MH MIXX',
        matricula: '010',
        pin_hash: pinHash,
      },
    ])

    const res = await validarPinOffline(pin, Date.now())
    expect(res.valido).toBe(true)
    expect(res.funcionario?.nome).toBe('Colaborador Teste MH MIXX')
    expect(res.deduplicado).toBe(false)
  })

  it('rejeita PIN inexistente no cache offline com mensagem padronizada', async () => {
    salvarCacheFuncionarios([
      {
        id: 'func_teste',
        nome: 'Colaborador Teste',
        matricula: '010',
        pin_hash: 'hash_qualquer',
      },
    ])

    const res = await validarPinOffline('9999', Date.now())
    expect(res.valido).toBe(false)
    expect(res.mensagemErro).toBe('PIN inválido ou não cadastrado.')
  })

  it('enfileira batidas offline de forma persistente e ordenada cronologicamente', () => {
    const now = Date.now()
    const batida1: BatidaOfflineFila = {
      id_requisicao: 'req_1',
      pin: '1234',
      funcionario_id: 'func_1',
      funcionario_nome: 'Func 1',
      timestamp_utc: new Date(now).toISOString(),
      server_timestamp_ms: now,
      criado_em_ms: now,
      tentativas: 0,
    }

    const batida2: BatidaOfflineFila = {
      id_requisicao: 'req_2',
      pin: '5678',
      funcionario_id: 'func_2',
      funcionario_nome: 'Func 2',
      timestamp_utc: new Date(now + 10000).toISOString(),
      server_timestamp_ms: now + 10000,
      criado_em_ms: now + 10000,
      tentativas: 0,
    }

    enfileirarBatidaOffline(batida2)
    enfileirarBatidaOffline(batida1)

    // Fila deve ordenar cronologicamente (batida1 primeiro, batida2 depois)
    const fila = carregarFilaOffline()
    expect(fila).toHaveLength(2)
    expect(fila[0].id_requisicao).toBe('req_1')
    expect(fila[1].id_requisicao).toBe('req_2')

    // Idempotência local: enfileirar mesmo id_requisicao não duplica
    enfileirarBatidaOffline(batida1)
    expect(carregarFilaOffline()).toHaveLength(2)

    // Remoção após sincronização
    removerBatidaOffline('req_1')
    const filaRestante = carregarFilaOffline()
    expect(filaRestante).toHaveLength(1)
    expect(filaRestante[0].id_requisicao).toBe('req_2')
  })

  it('aplica deduplicação de 90s offline para batidas consecutivas do mesmo funcionário', async () => {
    const pin = '4321'
    const pinHash = await computePinHash(pin, PIN_SALT)

    salvarCacheFuncionarios([
      {
        id: 'func_dedup',
        nome: 'Funcionario Dedup',
        matricula: '015',
        pin_hash: pinHash,
      },
    ])

    const t0 = Date.now()
    enfileirarBatidaOffline({
      id_requisicao: 'req_dedup_1',
      pin,
      funcionario_id: 'func_dedup',
      funcionario_nome: 'Funcionario Dedup',
      timestamp_utc: new Date(t0).toISOString(),
      server_timestamp_ms: t0,
      criado_em_ms: t0,
      tentativas: 0,
    })

    // Segunda batida 30s depois (dentro dos 90s)
    const t30 = t0 + 30 * 1000
    const resDedup = await validarPinOffline(pin, t30)
    expect(resDedup.valido).toBe(true)
    expect(resDedup.deduplicado).toBe(true)
    expect(resDedup.batidaAnterior?.id_requisicao).toBe('req_dedup_1')

    // Terceira batida 100s depois (fora dos 90s)
    const t100 = t0 + 100 * 1000
    const resValido = await validarPinOffline(pin, t100)
    expect(resValido.valido).toBe(true)
    expect(resValido.deduplicado).toBe(false)
  })

  it('exibe selo offline nas marcações do espelho de ponto', () => {
    const regNormal: RegistroHorario = {
      id: 'reg_normal',
      funcionario: 'func_1',
      data_utc: '2026-10-01',
      hora_utc: '11:00:00',
      timestamp_utc: '2026-10-01T11:00:00.000Z',
      origem: 'terminal',
      offline_sync: false,
      created: '2026-10-01T11:00:00.000Z',
      updated: '2026-10-01T11:00:00.000Z',
    }

    const regOffline: RegistroHorario = {
      id: 'reg_off',
      funcionario: 'func_1',
      data_utc: '2026-10-01',
      hora_utc: '20:00:00',
      timestamp_utc: '2026-10-01T20:00:00.000Z',
      origem: 'terminal',
      offline_sync: true,
      created: '2026-10-01T20:05:00.000Z',
      updated: '2026-10-01T20:05:00.000Z',
    }

    const resultado = calcularHorasRealizadas([regNormal, regOffline], [], null)
    expect(resultado.todasMarcacoes).toHaveLength(2)
    expect(resultado.todasMarcacoes[0].offline_sync).toBe(false)
    expect(resultado.todasMarcacoes[1].offline_sync).toBe(true)
  })
})
