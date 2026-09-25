import pb from '@/lib/pocketbase/client'
import type {
  Funcionario,
  Cargo,
  Departamento,
  Jornada,
  Empresa,
  RegistroHorario,
  Ferias,
  Ausencia,
  Solicitacao,
  HistoricoFuncionario,
  HistoricoJornada,
  User,
} from '@/types/rh'

export const funcionariosService = {
  async list(page = 1, perPage = 50, filter = '', sort = '-created') {
    return await pb.collection('funcionarios').getList<Funcionario>(page, perPage, {
      filter,
      sort,
      expand: 'cargo,departamento,jornada_atual,user',
    })
  },

  async getById(id: string) {
    return await pb.collection('funcionarios').getOne<Funcionario>(id, {
      expand: 'cargo,departamento,jornada_atual,user',
    })
  },

  async create(data: FormData | Partial<Funcionario>) {
    return await pb.collection('funcionarios').create<Funcionario>(data)
  },

  async update(id: string, data: FormData | Partial<Funcionario>) {
    return await pb.collection('funcionarios').update<Funcionario>(id, data)
  },

  async checkUniqueness(cpf: string, matricula: string, email: string, excludeId?: string) {
    const cleanCpf = cpf.replace(/\D/g, '')
    const errors: { cpf?: string; matricula?: string; email?: string } = {}

    try {
      const resCpf = await pb.collection('funcionarios').getList(1, 1, {
        filter: excludeId ? `cpf = "${cleanCpf}" && id != "${excludeId}"` : `cpf = "${cleanCpf}"`,
      })
      if (resCpf.totalItems > 0) {
        errors.cpf = 'Já existe um funcionário com este CPF.'
      }
    } catch {
      /* intentionally ignored */
    }

    try {
      const resMat = await pb.collection('funcionarios').getList(1, 1, {
        filter: excludeId
          ? `matricula = "${matricula.trim()}" && id != "${excludeId}"`
          : `matricula = "${matricula.trim()}"`,
      })
      if (resMat.totalItems > 0) {
        errors.matricula = 'Já existe um funcionário com esta matrícula.'
      }
    } catch {
      /* intentionally ignored */
    }

    try {
      const resEmail = await pb.collection('funcionarios').getList(1, 1, {
        filter: excludeId
          ? `email = "${email.trim().toLowerCase()}" && id != "${excludeId}"`
          : `email = "${email.trim().toLowerCase()}"`,
      })
      if (resEmail.totalItems > 0) {
        errors.email = 'Já existe um funcionário com este e-mail.'
      }
    } catch {
      /* intentionally ignored */
    }

    return errors
  },

  async desligar(id: string, motivo: string, adminUserId?: string) {
    const today = new Date().toISOString().split('T')[0]
    const func = await pb.collection('funcionarios').update<Funcionario>(id, {
      situacao: 'desligado',
      data_desligamento: today,
    })

    await historicoService.create({
      funcionario: id,
      tipo: 'desligamento',
      descricao: `Funcionário desligado. Motivo/observação: ${motivo || 'Sem observações adicionais.'}`,
      data: new Date().toISOString(),
      usuario_responsavel: adminUserId,
    })

    return func
  },

  async reativar(id: string, adminUserId?: string) {
    const func = await pb.collection('funcionarios').update<Funcionario>(id, {
      situacao: 'ativo',
      data_desligamento: '',
    })

    await historicoService.create({
      funcionario: id,
      tipo: 'reativacao',
      descricao: 'Funcionário reativado no sistema.',
      data: new Date().toISOString(),
      usuario_responsavel: adminUserId,
    })

    return func
  },
}

export const departamentosService = {
  async list() {
    return await pb.collection('departamentos').getFullList<Departamento>({
      sort: 'nome',
    })
  },

  async create(nome: string) {
    return await pb.collection('departamentos').create<Departamento>({ nome: nome.trim() })
  },

  async update(id: string, nome: string) {
    return await pb.collection('departamentos').update<Departamento>(id, { nome: nome.trim() })
  },

  async delete(id: string) {
    // Check if any employee is linked
    const linked = await pb.collection('funcionarios').getList(1, 1, {
      filter: `departamento = "${id}"`,
    })
    if (linked.totalItems > 0) {
      throw new Error('Não é possível excluir: existem funcionários vinculados.')
    }
    return await pb.collection('departamentos').delete(id)
  },
}

export const cargosService = {
  async list() {
    return await pb.collection('cargos').getFullList<Cargo>({
      sort: 'nome',
    })
  },

  async create(nome: string) {
    return await pb.collection('cargos').create<Cargo>({ nome: nome.trim() })
  },

  async update(id: string, nome: string) {
    return await pb.collection('cargos').update<Cargo>(id, { nome: nome.trim() })
  },

  async delete(id: string) {
    // Check if any employee is linked
    const linked = await pb.collection('funcionarios').getList(1, 1, {
      filter: `cargo = "${id}"`,
    })
    if (linked.totalItems > 0) {
      throw new Error('Não é possível excluir: existem funcionários vinculados.')
    }
    return await pb.collection('cargos').delete(id)
  },
}

export const jornadasService = {
  async list() {
    return await pb.collection('jornadas').getFullList<Jornada>({
      sort: 'nome',
    })
  },

  async getById(id: string) {
    return await pb.collection('jornadas').getOne<Jornada>(id)
  },

  async create(data: Partial<Jornada>) {
    return await pb.collection('jornadas').create<Jornada>(data)
  },

  async update(id: string, data: Partial<Jornada>) {
    return await pb.collection('jornadas').update<Jornada>(id, data)
  },

  async delete(id: string) {
    // Check if linked to any employee
    const linked = await pb.collection('funcionarios').getList(1, 1, {
      filter: `jornada_atual = "${id}"`,
    })
    if (linked.totalItems > 0) {
      throw new Error(
        'Não é possível excluir esta jornada: existem colaboradores vinculados a ela.',
      )
    }
    return await pb.collection('jornadas').delete(id)
  },
}

export const fechamentoFolhaService = {
  async getStatus(ano: number, mes: number): Promise<import('@/types/rh').FechamentoFolha | null> {
    const list = await pb
      .collection('fechamentos_folha')
      .getList<import('@/types/rh').FechamentoFolha>(1, 1, {
        filter: `competencia_ano = ${ano} && competencia_mes = ${mes}`,
        sort: '-created',
        expand: 'responsavel_abertura,responsavel_encerramento',
      })
    return list.items.length > 0 ? list.items[0] : null
  },

  async listAll(): Promise<import('@/types/rh').FechamentoFolha[]> {
    return await pb
      .collection('fechamentos_folha')
      .getFullList<import('@/types/rh').FechamentoFolha>({
        sort: '-competencia_ano,-competencia_mes',
        expand: 'responsavel_abertura,responsavel_encerramento',
      })
  },

  async alterarStatus(params: {
    competencia_ano: number
    competencia_mes: number
    acao: 'abrir_fechamento' | 'encerrar_fechamento' | 'reabrir_fechamento'
    observacoes?: string
  }): Promise<{ success: boolean; message: string; record?: any }> {
    return await pb.send('/backend/v1/rh/fechamento/status', {
      method: 'POST',
      body: params,
    })
  },

  async ajustarPonto(params: {
    funcionario: string
    data_registro: string
    hora_registro?: string
    tipo?: 'justificativa' | 'correcao' | 'classificacao'
    tipo_marcacao?: 'entrada' | 'inicio_intervalo' | 'retorno_intervalo' | 'saida' | 'outro'
    justificativa: string
    registro?: string
  }): Promise<{ success: boolean; message: string; tratamento_id?: string }> {
    return await pb.send('/backend/v1/rh/fechamento/ajustar-ponto', {
      method: 'POST',
      body: params,
    })
  },
}

export const bancoHorasService = {
  async listByFuncionario(
    funcionarioId: string,
  ): Promise<import('@/types/rh').BancoHorasLancamento[]> {
    return await pb
      .collection('banco_horas')
      .getFullList<import('@/types/rh').BancoHorasLancamento>({
        filter: `funcionario = "${funcionarioId}"`,
        sort: '-data_referencia,-created',
        expand: 'usuario_responsavel',
      })
  },

  async lancar(data: {
    funcionario: string
    data_referencia: string
    tipo: 'credito' | 'debito' | 'ajuste_manual'
    minutos: number
    motivo: string
  }): Promise<{ success: boolean; message: string }> {
    return await pb.send('/backend/v1/rh/banco-horas/lancar', {
      method: 'POST',
      body: data,
    })
  },

  async getSaldoFuncionario(funcionarioId: string): Promise<{
    minutos: number
    horasFormatadas: string
    totalCredito: number
    totalDebito: number
  }> {
    const list = await this.listByFuncionario(funcionarioId)
    let saldoMin = 0
    let totalCredito = 0
    let totalDebito = 0

    for (const item of list) {
      if (item.tipo === 'credito') {
        saldoMin += item.minutos
        totalCredito += item.minutos
      } else if (item.tipo === 'debito') {
        saldoMin -= item.minutos
        totalDebito += item.minutos
      } else if (item.tipo === 'ajuste_manual') {
        // Se motivo indicar crédito ou débito, ou padrão positivo
        saldoMin += item.minutos
        totalCredito += item.minutos
      }
    }

    const sign = saldoMin < 0 ? '-' : saldoMin > 0 ? '+' : ''
    const absMin = Math.abs(saldoMin)
    const h = Math.floor(absMin / 60)
    const m = absMin % 60
    const horasFormatadas = `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

    return {
      minutos: saldoMin,
      horasFormatadas,
      totalCredito,
      totalDebito,
    }
  },
}

export const atestadosService = {
  async uploadAtestado(params: {
    funcionarioId: string
    dataInicio: string
    dataFim?: string
    justificativa: string
    arquivo: File
    adminUserId?: string
  }) {
    // 1. Upload file into documentos collection as private atestado_medico
    const formData = new FormData()
    formData.append('funcionario', params.funcionarioId)
    formData.append('categoria', 'atestado_medico')
    formData.append('nome', `Atestado Médico - ${params.dataInicio}`)
    formData.append('data_envio', new Date().toISOString())
    formData.append('arquivo', params.arquivo)
    formData.append('nivel_acesso', 'restrito_rh')
    formData.append('ativo', 'true')
    if (params.adminUserId) {
      formData.append('usuario_responsavel', params.adminUserId)
    }

    const doc = await pb.collection('documentos').create(formData)

    // 2. Link into ausencias collection
    const ausencia = await pb.collection('ausencias').create({
      funcionario: params.funcionarioId,
      categoria: 'atestado',
      data_inicio: params.dataInicio,
      data_fim: params.dataFim || params.dataInicio,
      justificativa: params.justificativa,
      documentos: doc.id,
    })

    return { doc, ausencia }
  },

  getFileUrl(
    record: { id: string; collectionId: string; collectionName?: string },
    fileName: string,
  ) {
    return pb.files.getURL(record, fileName)
  },
}

export const espelhoPontoService = {
  async getDadosEspelho(funcionarioId: string, ano: number, mes: number) {
    const padMes = String(mes).padStart(2, '0')
    const startStr = `${ano}-${padMes}-01`
    const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate()
    const endStr = `${ano}-${padMes}-${String(ultimoDia).padStart(2, '0')}`

    // 1. Funcionario
    const func = await pb.collection('funcionarios').getOne<Funcionario>(funcionarioId, {
      expand: 'cargo,departamento,jornada_atual',
    })

    // 2. Historico Jornadas
    const histJornadas = await pb
      .collection('historico_jornadas')
      .getFullList<import('@/types/rh').HistoricoJornada>({
        filter: `funcionario = "${funcionarioId}"`,
        expand: 'jornada',
        sort: '-data_inicio',
      })

    // 3. Registros de Horário (timestamp_utc >= startStr && timestamp_utc <= endStr 23:59:59 OR data_utc)
    // Filter safely covering timezone boundary: 2 days before to 2 days after
    const prevDate = new Date(ano, mes - 1, 0).toISOString().split('T')[0]
    const nextDate = new Date(ano, mes, 2).toISOString().split('T')[0]

    const registros = await pb.collection('registros_horario').getFullList<RegistroHorario>({
      filter: `funcionario = "${funcionarioId}" && (
        (data_utc >= "${startStr}" && data_utc <= "${endStr}") ||
        (timestamp_utc >= "${prevDate} 00:00:00" && timestamp_utc <= "${nextDate} 23:59:59")
      )`,
      sort: 'timestamp_utc,hora_utc',
    })

    // 4. Tratamentos do Mês
    const tratamentos = await pb
      .collection('tratamentos_ponto')
      .getFullList<import('@/types/rh').TratamentoPonto>({
        filter: `funcionario = "${funcionarioId}" && (data_registro >= "${startStr}" && data_registro <= "${endStr}")`,
        sort: 'data_registro,hora_registro',
        expand: 'usuario_responsavel',
      })

    // 5. Ausências no Mês
    const ausencias = await pb.collection('ausencias').getFullList<Ausencia>({
      filter: `funcionario = "${funcionarioId}" && (
        (data_inicio <= "${endStr}" && (data_fim >= "${startStr}" || data_fim = "" || data_fim = null))
      )`,
      expand: 'documentos',
      sort: 'data_inicio',
    })

    // 6. Férias no Mês
    const ferias = await pb.collection('ferias').getFullList<Ferias>({
      filter: `funcionario = "${funcionarioId}" && status = "aprovado" && (
        (data_inicio <= "${endStr}" && data_fim >= "${startStr}")
      )`,
      sort: 'data_inicio',
    })

    // 7. Status do fechamento da competência
    const fechamento = await fechamentoFolhaService.getStatus(ano, mes)

    return {
      funcionario: func,
      historicoJornadas: histJornadas.map((h) => ({
        data_inicio: h.data_inicio,
        data_fim: h.data_fim,
        jornada: (h.expand?.jornada || func.expand?.jornada_atual) as Jornada,
      })),
      registros,
      tratamentos,
      ausencias,
      ferias,
      fechamento,
    }
  },
}

export const empresaService = {
  async get() {
    const list = await pb.collection('empresa').getList<Empresa>(1, 1, { sort: '-created' })
    if (list.items.length > 0) {
      return list.items[0]
    }
    return null
  },

  async update(id: string, data: FormData | Partial<Empresa>) {
    return await pb.collection('empresa').update<Empresa>(id, data)
  },
}

export const historicoService = {
  async listByFuncionario(funcionarioId: string) {
    return await pb.collection('historico_funcionario').getFullList<HistoricoFuncionario>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-data,-created',
      expand: 'usuario_responsavel',
    })
  },

  async create(data: Partial<HistoricoFuncionario>) {
    return await pb.collection('historico_funcionario').create<HistoricoFuncionario>(data)
  },
}

export const historicoJornadasService = {
  async listByFuncionario(funcionarioId: string) {
    return await pb.collection('historico_jornadas').getFullList<HistoricoJornada>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-data_inicio',
      expand: 'jornada',
    })
  },

  async create(data: Partial<HistoricoJornada>) {
    return await pb.collection('historico_jornadas').create<HistoricoJornada>(data)
  },
}

export const usersService = {
  async listAdmins() {
    return await pb.collection('users').getFullList<User>({
      filter: 'role = "admin"',
      sort: 'name,email',
    })
  },

  async createAdmin(data: {
    email: string
    password: string
    passwordConfirm: string
    name: string
    nome?: string
  }) {
    return await pb.collection('users').create<User>({
      email: data.email.trim(),
      password: data.password,
      passwordConfirm: data.passwordConfirm,
      name: data.name.trim(),
      nome: data.name.trim(),
      role: 'admin',
      ativo: true,
      emailVisibility: false,
    })
  },

  async updateAdmin(id: string, data: { name?: string; nome?: string; ativo?: boolean }) {
    return await pb.collection('users').update<User>(id, data)
  },

  async requestPasswordReset(email: string) {
    return await pb.collection('users').requestPasswordReset(email)
  },

  async delete(id: string) {
    return await pb.collection('users').delete(id)
  },
}

export interface TerminalInfo {
  status: 'online' | 'offline'
  server_time_utc: string
  empresa: {
    id: string
    nome_fantasia: string
    razao_social: string
    logotipo: string
    fuso_horario: string
  }
}

export interface RegistroPontoResult {
  success: boolean
  idempotent?: boolean
  identificador?: string
  funcionario_nome?: string
  data_formatada?: string
  horario_formatado?: string
  timestamp_utc?: string
  fuso_horario?: string
  mensagem?: string
  message?: string
  locked?: boolean
}

export const terminalService = {
  async getInfo(): Promise<TerminalInfo> {
    return await pb.send<TerminalInfo>('/backend/v1/rh/terminal/info', {
      method: 'GET',
    })
  },

  async registrarPonto(data: {
    matricula: string
    pin: string
    id_requisicao: string
  }): Promise<RegistroPontoResult> {
    return await pb.send<RegistroPontoResult>('/backend/v1/rh/ponto/registrar', {
      method: 'POST',
      body: data,
    })
  },

  async updatePin(funcionarioId: string, pin: string) {
    return await pb.send<{ success: boolean; message: string }>('/backend/v1/rh/pin/update', {
      method: 'POST',
      body: { funcionarioId, pin },
    })
  },
}

export const dashboardService = {
  async getMetrics() {
    // 1. Total de Funcionários Ativos
    const ativosRes = await pb.collection('funcionarios').getList(1, 1, {
      filter: 'situacao = "ativo"',
    })
    const totalAtivos = ativosRes.totalItems

    // 2. Entradas Registradas Hoje (America/Sao_Paulo)
    // Convert current time to America/Sao_Paulo date string YYYY-MM-DD
    const spNow = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()) // Returns YYYY-MM-DD

    const todosRegistros = await pb.collection('registros_horario').getFullList<RegistroHorario>({
      sort: '-timestamp_utc,-created',
      expand: 'funcionario',
    })

    // Filter registrations that correspond to today in America/Sao_Paulo
    const hojeRegistros = todosRegistros.filter((r) => {
      const d = r.timestamp_utc ? new Date(r.timestamp_utc) : new Date(r.created)
      const rSpDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
      return rSpDate === spNow
    })

    const distinctHojeFuncs = new Set(hojeRegistros.map((r) => r.funcionario))
    const entradasHoje = distinctHojeFuncs.size

    const todayStr = spNow

    // 3. Funcionários em Férias
    // Vacation where status = 'aprovado' and data_inicio <= today <= data_fim
    const feriasAtivas = await pb.collection('ferias').getList(1, 1, {
      filter: `status = "aprovado" && data_inicio <= "${todayStr}" && data_fim >= "${todayStr}"`,
    })
    const emFerias = feriasAtivas.totalItems

    // 4. Ausências Informadas
    // Absence where data_inicio <= today <= data_fim
    const ausenciasAtivas = await pb.collection('ausencias').getList(1, 1, {
      filter: `data_inicio <= "${todayStr}" && (data_fim >= "${todayStr}" || data_fim = null || data_fim = "")`,
    })
    const ausenciasHoje = ausenciasAtivas.totalItems

    // 5. Solicitações Pendentes
    const pendentesRes = await pb.collection('solicitacoes').getList(1, 1, {
      filter: 'status = "pendente"',
    })
    const solicitacoesPendentes = pendentesRes.totalItems

    // 6. Férias nos Próximos 30 Dias
    const thirtyDaysAhead = new Date()
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)
    const thirtyDaysStr = thirtyDaysAhead.toISOString().split('T')[0]

    const proximasFeriasRes = await pb.collection('ferias').getList(1, 1, {
      filter: `status = "aprovado" && data_inicio >= "${todayStr}" && data_inicio <= "${thirtyDaysStr}"`,
    })
    const feriasProximos30Dias = proximasFeriasRes.totalItems

    return {
      totalAtivos,
      entradasHoje,
      emFerias,
      ausenciasHoje,
      solicitacoesPendentes,
      feriasProximos30Dias,
    }
  },

  async getMovimentacoesHoje() {
    const spNow = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    try {
      const registros = await pb.collection('registros_horario').getFullList<RegistroHorario>({
        sort: '-timestamp_utc,-created',
        expand: 'funcionario',
      })

      // Filter in memory to ensure precise America/Sao_Paulo matching
      const filtered = registros.filter((r) => {
        const d = r.timestamp_utc ? new Date(r.timestamp_utc) : new Date(r.created)
        const rSpDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Sao_Paulo',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d)
        return rSpDate === spNow
      })

      return filtered.slice(0, 20)
    } catch {
      return []
    }
  },

  async getProximosEventos() {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const thirtyDaysAhead = new Date()
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30)
    const thirtyDaysStr = thirtyDaysAhead.toISOString().split('T')[0]

    interface Evento {
      id: string
      tipo: 'ferias' | 'aniversario' | 'documento'
      titulo: string
      data: string
      dataFormatted: string
    }

    const eventos: Evento[] = []

    // 1. Férias programadas
    try {
      const ferias = await pb.collection('ferias').getFullList<Ferias>({
        filter: `status = "aprovado" && data_inicio >= "${todayStr}" && data_inicio <= "${thirtyDaysStr}"`,
        sort: 'data_inicio',
        expand: 'funcionario',
      })
      for (const f of ferias) {
        const nome = f.expand?.funcionario?.nome || 'Funcionário'
        eventos.push({
          id: `ferias-${f.id}`,
          tipo: 'ferias',
          titulo: `Férias de ${nome} começam`,
          data: f.data_inicio,
          dataFormatted: f.data_inicio,
        })
      }
    } catch {
      /* intentionally ignored */
    }

    // 2. Aniversários dos funcionários nos próximos 30 dias
    try {
      const funcs = await pb.collection('funcionarios').getFullList<Funcionario>({
        filter: 'situacao = "ativo" && data_nascimento != "" && data_nascimento != null',
      })

      const currentYear = today.getFullYear()
      for (const f of funcs) {
        if (!f.data_nascimento) continue
        const [_, month, day] = f.data_nascimento.split('T')[0].split('-')
        if (!month || !day) continue

        // Birthday in current year
        let bdayThisYear = new Date(currentYear, parseInt(month, 10) - 1, parseInt(day, 10))
        if (bdayThisYear < today) {
          bdayThisYear = new Date(currentYear + 1, parseInt(month, 10) - 1, parseInt(day, 10))
        }

        const diffTime = bdayThisYear.getTime() - today.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        if (diffDays >= 0 && diffDays <= 30) {
          eventos.push({
            id: `aniv-${f.id}`,
            tipo: 'aniversario',
            titulo: `Aniversário de ${f.nome}`,
            data: bdayThisYear.toISOString().split('T')[0],
            dataFormatted: `${day.padStart(2, '0')}/${month.padStart(2, '0')}`,
          })
        }
      }
    } catch {
      /* intentionally ignored */
    }

    // 3. Documentos vencendo nos próximos 30 dias
    try {
      const docs = await pb.collection('documentos').getFullList({
        filter: `ativo = true && data_validade >= "${todayStr}" && data_validade <= "${thirtyDaysStr}"`,
        sort: 'data_validade',
        expand: 'funcionario',
      })
      for (const d of docs as any[]) {
        const funcNome = d.expand?.funcionario?.nome || 'Funcionário'
        eventos.push({
          id: `doc-${d.id}`,
          tipo: 'documento',
          titulo: `Documento ${d.nome} de ${funcNome} vence`,
          data: d.data_validade,
          dataFormatted: d.data_validade,
        })
      }
    } catch {
      /* intentionally ignored */
    }

    // Sort by date ascending
    eventos.sort((a, b) => a.data.localeCompare(b.data))

    return eventos
  },
}
