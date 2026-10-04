import pb from '@/lib/pocketbase/client'
import type { TerminalInfo, RegistroPontoResult } from '@/services/rh'

export const PIN_SALT = 'rh_skip_pin_salt_2026'

export interface FuncionarioCacheOffline {
  id: string
  nome: string
  matricula: string
  pin_hash: string
}

export interface BatidaOfflineFila {
  id_requisicao: string
  pin: string
  funcionario_id?: string
  funcionario_nome?: string
  modo_contingencia?: boolean
  timestamp_utc: string
  server_timestamp_ms: number
  criado_em_ms: number
  tentativas: number
  ultimo_erro?: string
}

const STORAGE_KEY_QUEUE = 'mhmixx_terminal_offline_queue'
const STORAGE_KEY_CACHE = 'mhmixx_terminal_cached_funcs'
const STORAGE_KEY_INFO = 'mhmixx_terminal_cached_info'

/**
 * Calcula o hash SHA-256 no formato hex no browser via Web Crypto API
 * Compatível 100% com $security.sha256(pin + ':' + salt) do PocketBase
 */
export async function computePinHash(pin: string, salt: string = PIN_SALT): Promise<string> {
  const text = `${pin}:${salt}`
  const encoder = new TextEncoder()
  const data = encoder.encode(text)

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  // Fallback puro JS caso crypto.subtle não esteja disponível (ambientes legados/testes sem HTTPS)
  return fallbackSha256(text)
}

/**
 * Implementação pura de SHA-256 para ambientes sem Web Crypto API
 */
function fallbackSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount))
  }

  const mathPow = Math.pow
  const maxWord = mathPow(2, 32)
  let lengthProperty = 'length'
  let i = 0
  let j = 0
  let result = ''

  const words: number[] = []
  const asciiBitLength = ascii[lengthProperty] * 8

  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]

  let candidate = 2
  const w = new Array(64)

  for (i = 0; i < ascii[lengthProperty]; i++) {
    const charCode = ascii.charCodeAt(i)
    words[i >> 2] |= charCode << ((3 - (i % 4)) * 8)
  }

  words[asciiBitLength >> 5] |= 0x80 << (24 - (asciiBitLength % 32))
  words[(((asciiBitLength + 64) >> 9) << 4) + 15] = asciiBitLength

  for (let round = 0; round < words.length; round += 16) {
    const wSub = w
    for (i = 0; i < 16; i++) {
      wSub[i] = words[round + i] | 0
    }
    for (i = 16; i < 64; i++) {
      const s0 = rightRotate(wSub[i - 15], 7) ^ rightRotate(wSub[i - 15], 18) ^ (wSub[i - 15] >>> 3)
      const s1 = rightRotate(wSub[i - 2], 17) ^ rightRotate(wSub[i - 2], 19) ^ (wSub[i - 2] >>> 10)
      wSub[i] = (wSub[i - 16] + s0 + wSub[i - 7] + s1) | 0
    }

    let a = hash[0]
    let b = hash[1]
    let c = hash[2]
    let d = hash[3]
    let e = hash[4]
    let f = hash[5]
    let g = hash[6]
    let h = hash[7]

    for (i = 0; i < 64; i++) {
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + s1 + ch + k[i] + wSub[i]) | 0
      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (s0 + maj) | 0

      h = g
      g = f
      f = e
      e = (d + temp1) | 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) | 0
    }

    hash[0] = (hash[0] + a) | 0
    hash[1] = (hash[1] + b) | 0
    hash[2] = (hash[2] + c) | 0
    hash[3] = (hash[3] + d) | 0
    hash[4] = (hash[4] + e) | 0
    hash[5] = (hash[5] + f) | 0
    hash[6] = (hash[6] + g) | 0
    hash[7] = (hash[7] + h) | 0
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j >= 0; j--) {
      const b = (hash[i] >> (j * 8)) & 255
      result += (b < 16 ? '0' : '') + b.toString(16)
    }
  }

  return result
}

// ----------------------------------------------------------------------------------
// Gerenciamento do Cache de Funcionários e Informações do Terminal
// ----------------------------------------------------------------------------------

export function salvarCacheFuncionarios(funcs: FuncionarioCacheOffline[]): void {
  try {
    if (Array.isArray(funcs) && funcs.length > 0) {
      localStorage.setItem(STORAGE_KEY_CACHE, JSON.stringify(funcs))
    }
  } catch (err) {
    console.warn('Falha ao salvar cache de funcionários no localStorage:', err)
  }
}

export function carregarCacheFuncionarios(): FuncionarioCacheOffline[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CACHE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function salvarCacheTerminalInfo(info: TerminalInfo): void {
  try {
    if (info) {
      localStorage.setItem(STORAGE_KEY_INFO, JSON.stringify(info))
    }
  } catch (err) {
    console.warn('Falha ao salvar cache do terminal no localStorage:', err)
  }
}

export function carregarCacheTerminalInfo(): TerminalInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INFO)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ----------------------------------------------------------------------------------
// Fila de Batidas Offline (Persistente no localStorage)
// ----------------------------------------------------------------------------------

export function carregarFilaOffline(): BatidaOfflineFila[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_QUEUE)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Ordenado cronologicamente pelo timestamp da batida
    return parsed.sort((a, b) => a.server_timestamp_ms - b.server_timestamp_ms)
  } catch {
    return []
  }
}

export function salvarFilaOffline(fila: BatidaOfflineFila[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(fila))
  } catch (err) {
    console.error('Erro crítico: Falha ao persistir fila offline no localStorage:', err)
  }
}

export function enfileirarBatidaOffline(batida: BatidaOfflineFila): void {
  const fila = carregarFilaOffline()
  // Idempotência local: se já existir com o mesmo id_requisicao, não duplica
  const index = fila.findIndex((b) => b.id_requisicao === batida.id_requisicao)
  if (index >= 0) {
    fila[index] = batida
  } else {
    fila.push(batida)
  }
  salvarFilaOffline(fila)
}

export function removerBatidaOffline(idRequisicao: string): void {
  const fila = carregarFilaOffline()
  const novaFila = fila.filter((b) => b.id_requisicao !== idRequisicao)
  salvarFilaOffline(novaFila)
}

export function obterTamanhoFilaOffline(): number {
  return carregarFilaOffline().length
}

// ----------------------------------------------------------------------------------
// Validação Offline de PIN e Deduplicação Local de 90s
// ----------------------------------------------------------------------------------

export interface ValidacaoOfflineResult {
  valido: boolean
  funcionario?: FuncionarioCacheOffline
  modoContingencia?: boolean
  mensagemErro?: string
  motivoBloqueio?: boolean
  deduplicado?: boolean
  batidaAnterior?: BatidaOfflineFila
}

const DEDUP_WINDOW_MS = 90 * 1000 // 90 segundos

/**
 * Valida o PIN localmente contra o cache de funcionários ativos e aplica deduplicação local.
 * Se o cache de funcionários estiver vazio (ex.: terminal recarregado sem internet antes do sync inicial),
 * entra no MODO DE CONTINGÊNCIA: acolhe o PIN formatado (4-6 dígitos) na fila com flag de contingência,
 * garantindo que nenhum funcionário fique sem bater o ponto.
 */
export async function validarPinOffline(
  pin: string,
  nowServerMs: number,
): Promise<ValidacaoOfflineResult> {
  const cache = carregarCacheFuncionarios()

  // Se o terminal não tiver cache carregado, aciona modo de contingência
  if (!cache || cache.length === 0) {
    // Deduplicação local de contingência pelo próprio PIN
    const fila = carregarFilaOffline()
    const batidasPin = fila.filter((b) => b.pin === pin)
    if (batidasPin.length > 0) {
      batidasPin.sort((a, b) => b.server_timestamp_ms - a.server_timestamp_ms)
      const ultBatida = batidasPin[0]
      const diff = Math.abs(nowServerMs - ultBatida.server_timestamp_ms)
      if (diff < DEDUP_WINDOW_MS) {
        return {
          valido: true,
          modoContingencia: true,
          deduplicado: true,
          batidaAnterior: ultBatida,
        }
      }
    }

    return {
      valido: true,
      modoContingencia: true,
      deduplicado: false,
    }
  }

  const hashCalculado = await computePinHash(pin)
  const funcionario = cache.find((f) => f.pin_hash === hashCalculado)

  if (!funcionario) {
    return {
      valido: false,
      mensagemErro: 'PIN inválido ou não cadastrado.',
    }
  }

  // Verificar se há batida recente do mesmo funcionário na fila offline (< 90s)
  const fila = carregarFilaOffline()
  const batidasFunc = fila.filter((b) => b.funcionario_id === funcionario.id || b.pin === pin)

  if (batidasFunc.length > 0) {
    // Pega a mais recente
    batidasFunc.sort((a, b) => b.server_timestamp_ms - a.server_timestamp_ms)
    const ultBatida = batidasFunc[0]
    const diff = Math.abs(nowServerMs - ultBatida.server_timestamp_ms)

    if (diff < DEDUP_WINDOW_MS) {
      return {
        valido: true,
        funcionario,
        deduplicado: true,
        batidaAnterior: ultBatida,
      }
    }
  }

  return {
    valido: true,
    funcionario,
    deduplicado: false,
  }
}

// ----------------------------------------------------------------------------------
// Sincronizador Automático de Batidas Offline
// ----------------------------------------------------------------------------------

export interface SincronizacaoResult {
  sucessos: number
  falhas: number
  duplicadasDescartadas: number
  restantesNaFila: number
}

let isSyncing = false

/**
 * Sincroniza todas as batidas pendentes na fila em ordem cronológica estrita
 */
export async function sincronizarFilaOffline(): Promise<SincronizacaoResult> {
  if (isSyncing) {
    return {
      sucessos: 0,
      falhas: 0,
      duplicadasDescartadas: 0,
      restantesNaFila: obterTamanhoFilaOffline(),
    }
  }

  isSyncing = true
  let sucessos = 0
  let falhas = 0
  let duplicadasDescartadas = 0

  try {
    const fila = carregarFilaOffline()
    if (fila.length === 0) {
      return {
        sucessos: 0,
        falhas: 0,
        duplicadasDescartadas: 0,
        restantesNaFila: 0,
      }
    }

    // Processar uma a uma em ordem cronológica
    for (const item of fila) {
      try {
        const payload = {
          pin: item.pin,
          matricula: '',
          id_requisicao: item.id_requisicao,
          timestamp_utc: item.timestamp_utc,
          offline_sync: true,
          offline: true,
        }

        const res = await pb.send<RegistroPontoResult>('/backend/v1/rh/ponto/registrar', {
          method: 'POST',
          body: payload,
        })

        if (res && res.success) {
          // Sucesso ou deduplicado (dedup de 90s do backend)
          if (res.deduplicated || res.idempotent) {
            duplicadasDescartadas++
          } else {
            sucessos++
          }
          // Remove com segurança da fila
          removerBatidaOffline(item.id_requisicao)
        } else {
          // Se o backend explicitamente recusou com 200 success=false
          falhas++
        }
      } catch (err: any) {
        const status = err?.status || err?.response?.status
        const data = err?.data || err?.response?.data || {}

        // Se o erro foi deduplicação ou registro já gravado com idempotência
        if (data && (data.idempotent || data.deduplicated)) {
          duplicadasDescartadas++
          removerBatidaOffline(item.id_requisicao)
          continue
        }

        // Se for erro definitivo (PIN excluído/desligado 401/403), removemos para não travar a fila
        if (status === 401 || status === 403) {
          falhas++
          removerBatidaOffline(item.id_requisicao)
          continue
        }

        // Se falhou por conexão de rede (status 0, timeout, 502/503/504), interrompe a fila para tentar novamente depois
        falhas++
        const atualizada = carregarFilaOffline()
        const alvo = atualizada.find((b) => b.id_requisicao === item.id_requisicao)
        if (alvo) {
          alvo.tentativas = (alvo.tentativas || 0) + 1
          alvo.ultimo_erro = err?.message || 'Falha de rede'
          salvarFilaOffline(atualizada)
        }
        break // Interrompe para manter a ordem cronológica
      }
    }
  } finally {
    isSyncing = false
  }

  return {
    sucessos,
    falhas,
    duplicadasDescartadas,
    restantesNaFila: obterTamanhoFilaOffline(),
  }
}
