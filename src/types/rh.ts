export interface User {
  id: string
  email: string
  name?: string
  nome?: string
  role: 'admin' | 'rh' | 'funcionario'
  ativo: boolean
  avatar?: string
  created: string
  updated: string
}

export interface Empresa {
  id: string
  razao_social: string
  nome_fantasia: string
  cnpj: string
  endereco: string
  telefone: string
  email: string
  logotipo?: string
  fuso_horario: string
  responsavel_rh: string
  created: string
  updated: string
}

export interface Departamento {
  id: string
  nome: string
  created: string
  updated: string
  expand?: {
    funcionarios_via_departamento?: Funcionario[]
  }
}

export interface Cargo {
  id: string
  nome: string
  created: string
  updated: string
  expand?: {
    funcionarios_via_cargo?: Funcionario[]
  }
}

export type DiaSemanaSigla = 'seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom'

export interface HorarioDiaSemana {
  ativo: boolean
  hora_entrada: string
  hora_inicio_intervalo?: string
  hora_retorno_intervalo?: string
  hora_saida: string
  duracao_min: number
  atravessa_meia_noite?: boolean
}

export type GradeSemanal = Record<DiaSemanaSigla, HorarioDiaSemana>

export interface Jornada {
  id: string
  nome: string
  dias_trabalho: DiaSemanaSigla[]
  hora_entrada: string
  hora_inicio_intervalo: string
  hora_retorno_intervalo: string
  hora_saida: string
  duracao_jornada_min: number
  dias_folga: DiaSemanaSigla[]
  atravessa_meia_noite?: boolean
  tipo_escala?: 'semanal_fixa' | 'escala_12x36' | 'escala_6x1' | 'personalizada'
  grade_semanal?: GradeSemanal | null
  ativo?: boolean
  created: string
  updated: string
}

export interface Funcionario {
  id: string
  user?: string
  nome: string
  cpf: string
  data_nascimento?: string
  telefone?: string
  email: string
  endereco?: string
  fotografia?: string
  contato_emergencia?: string
  matricula: string
  data_admissao: string
  cargo?: string
  departamento?: string
  tipo_vinculo?: 'CLT' | 'Estágio' | 'PJ' | 'Terceirizado' | 'Aprendiz'
  jornada_atual?: string
  situacao: 'ativo' | 'afastado' | 'em_ferias' | 'desligado'
  data_desligamento?: string
  salario_contratual?: number
  data_inicio_contrato?: string
  tipo_contrato?: 'CLT' | 'Estágio' | 'PJ' | 'Terceirizado' | 'Aprendiz'
  pin_hash?: string
  created: string
  updated: string
  expand?: {
    cargo?: Cargo
    departamento?: Departamento
    jornada_atual?: Jornada
    user?: User
  }
}

export interface HistoricoJornada {
  id: string
  funcionario: string
  jornada: string
  data_inicio: string
  data_fim?: string
  created: string
  updated: string
  expand?: {
    jornada?: Jornada
  }
}

export interface RegistroHorario {
  id: string
  funcionario: string
  data_utc: string
  hora_utc: string
  timestamp_utc: string
  origem: 'terminal' | 'admin' | 'portal'
  id_requisicao?: string
  offline_sync?: boolean
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
  }
}

export interface TratamentoPonto {
  id: string
  registro?: string
  funcionario: string
  tipo: 'justificativa' | 'correcao' | 'classificacao' | 'anulacao'
  justificativa: string
  usuario_responsavel?: string
  data_tratamento: string
  informacao_corrigida?: string
  data_registro?: string
  hora_registro?: string
  tipo_marcacao?: 'entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida' | 'outro'
  origem_ajuste?:
    | 'inclusao_ponto_faltante'
    | 'justificativa_inconsistencia'
    | 'abono_horas'
    | 'anulacao_marcacao_duplicada'
    | 'anulacao_marcacao_indevida'
    | 'correcao_horario_batida'
    | 'anulacao_por_correcao'
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    registro?: RegistroHorario
    usuario_responsavel?: User
  }
}

export interface FechamentoFolha {
  id: string
  competencia_ano: number
  competencia_mes: number
  status: 'aberto_fechamento' | 'fechado'
  data_abertura_fechamento?: string
  data_encerramento?: string
  responsavel_abertura?: string
  responsavel_encerramento?: string
  observacoes?: string
  created: string
  updated: string
  expand?: {
    responsavel_abertura?: User
    responsavel_encerramento?: User
  }
}

export interface BancoHorasLancamento {
  id: string
  funcionario: string
  data_referencia: string
  tipo: 'credito' | 'debito' | 'ajuste_manual'
  minutos: number
  motivo: string
  usuario_responsavel?: string
  competencia_ano?: number
  competencia_mes?: number
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    usuario_responsavel?: User
  }
}

export interface Ferias {
  id: string
  funcionario: string
  data_inicio: string
  data_fim: string
  dias?: number
  dias_abono?: number
  tipo?: 'integral' | 'fracionada'
  status: 'programada' | 'em_gozo' | 'concluida' | 'cancelada' | 'solicitado' | 'aprovado'
  periodo_aquisitivo_inicio?: string
  periodo_aquisitivo_fim?: string
  periodo_concessivo_fim?: string
  saldo_dias?: number
  dias_usufruidos?: number
  solicitado_por?: string
  usuario_responsavel?: string
  observacoes?: string
  justificativa_rh?: string
  faltas_injustificadas_periodo?: number
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    usuario_responsavel?: User
    solicitado_por?: User
  }
}

export interface Ausencia {
  id: string
  funcionario: string
  categoria:
    | 'falta'
    | 'atraso_justificado'
    | 'atestado'
    | 'afastamento'
    | 'licenca'
    | 'folga_compensatoria'
  situacao?: 'informada' | 'justificada' | 'abonada' | 'nao_justificada'
  data_inicio: string
  data_fim?: string
  justificativa?: string
  documentos?: string
  usuario_responsavel?: string
  impacta_aquisitivo?: boolean
  observacoes?: string
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    documentos?: Documento
    usuario_responsavel?: User
  }
}

export interface Documento {
  id: string
  funcionario: string
  categoria:
    | 'contrato_trabalho'
    | 'documentacao_admissional'
    | 'atestado_medico'
    | 'comprovantes'
    | 'termos_internos'
    | 'documentos_ferias'
    | 'outros'
  nome: string
  descricao?: string
  data_envio?: string
  data_validade?: string
  arquivo?: string
  nivel_acesso: 'publico_interno' | 'restrito_rh' | 'restrito_medico'
  usuario_responsavel?: string
  ativo?: boolean
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    usuario_responsavel?: User
  }
}

export interface Holerite {
  id: string
  funcionario: string
  competencia_mes: number
  competencia_ano: number
  data_envio?: string
  arquivo?: string
  usuario_responsavel?: string
  versao?: number
  observacoes?: string
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    usuario_responsavel?: User
  }
}

export interface HoleriteVersao {
  id: string
  holerite: string
  funcionario: string
  competencia_mes: number
  competencia_ano: number
  versao: number
  motivo_substituicao?: string
  arquivo?: string
  usuario_responsavel?: string
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
    usuario_responsavel?: User
  }
}

export interface Solicitacao {
  id: string
  funcionario: string
  tipo: 'correcao_ponto' | 'justificativa' | 'ferias' | 'documento' | 'outro'
  status: 'pendente' | 'aprovado' | 'recusado' | 'cancelado'
  motivo?: string
  detalhes?: string
  decidido_por?: string
  decidido_em?: string
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
  }
}

export interface HistoricoFuncionario {
  id: string
  funcionario: string
  tipo:
    | 'cadastro'
    | 'edicao'
    | 'promocao'
    | 'desligamento'
    | 'reativacao'
    | 'alteracao_salarial'
    | 'outro'
  descricao: string
  data: string
  usuario_responsavel?: string
  created: string
  updated: string
  expand?: {
    usuario_responsavel?: User
  }
}

export interface LogAuditoria {
  id: string
  usuario?: string
  acao: string
  entidade?: string
  entidade_id?: string
  detalhes?: string
  ip?: string
  data: string
  nivel: 'info' | 'sensivel'
  created: string
  updated: string
}

export type TipoFeriado = 'nacional' | 'estadual' | 'municipal' | 'empresa'

export interface Feriado {
  id: string
  data: string // YYYY-MM-DD ou ISO
  nome: string
  tipo: TipoFeriado
  recorrente: boolean
  ativo: boolean
  created: string
  updated: string
}
