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

export interface Jornada {
  id: string
  nome: string
  dias_trabalho: ('seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom')[]
  hora_entrada: string
  hora_inicio_intervalo: string
  hora_retorno_intervalo: string
  hora_saida: string
  duracao_jornada_min: number
  dias_folga: ('seg' | 'ter' | 'qua' | 'qui' | 'sex' | 'sab' | 'dom')[]
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
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
  }
}

export interface Ferias {
  id: string
  funcionario: string
  data_inicio: string
  data_fim: string
  dias?: number
  tipo?: 'integral' | 'fracionada'
  status: 'solicitado' | 'aprovado' | 'concluido'
  periodo_aquisitivo_inicio?: string
  periodo_aquisitivo_fim?: string
  periodo_concessivo_fim?: string
  saldo_dias?: number
  dias_usufruidos?: number
  solicitado_por?: string
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
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
  data_inicio: string
  data_fim?: string
  justificativa?: string
  documentos?: string
  created: string
  updated: string
  expand?: {
    funcionario?: Funcionario
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
