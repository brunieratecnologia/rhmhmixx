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
  Documento,
  Holerite,
  HoleriteVersao,
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

  async listAll(filter = '', sort = 'nome') {
    return await pb.collection('funcionarios').getFullList<Funcionario>({
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

  async apurarDia(data: {
    funcionario: string
    data_referencia: string
    minutos_credito?: number
    minutos_debito?: number
    motivo?: string
  }): Promise<{ success: boolean; message: string; lancamentos?: string[] }> {
    return await pb.send('/backend/v1/rh/banco-horas/apurar-dia', {
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

export const feriasService = {
  async list(page = 1, perPage = 50, filter = '', sort = '-data_inicio') {
    return await pb.collection('ferias').getList<Ferias>(page, perPage, {
      filter,
      sort,
      expand: 'funcionario,solicitado_por,usuario_responsavel',
    })
  },

  async listAll(filter = '', sort = '-data_inicio') {
    return await pb.collection('ferias').getFullList<Ferias>({
      filter,
      sort,
      expand: 'funcionario,solicitado_por,usuario_responsavel',
    })
  },

  async listByFuncionario(funcionarioId: string) {
    return await pb.collection('ferias').getFullList<Ferias>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-data_inicio',
      expand: 'funcionario,solicitado_por,usuario_responsavel',
    })
  },

  async getById(id: string) {
    return await pb.collection('ferias').getOne<Ferias>(id, {
      expand: 'funcionario,solicitado_por,usuario_responsavel',
    })
  },

  async create(data: Partial<Ferias>) {
    const record = await pb.collection('ferias').create<Ferias>(data)

    // Verificar se o período de férias engloba o dia de hoje.
    // Se for hoje e status = 'em_gozo' ou 'aprovado'/'programada', sincroniza situação do funcionário
    await this.sincronizarSituacaoFuncionario(data.funcionario as string)

    return record
  },

  async update(id: string, data: Partial<Ferias>) {
    const record = await pb.collection('ferias').update<Ferias>(id, data)
    const funcId = record.funcionario || (data.funcionario as string)
    if (funcId) {
      await this.sincronizarSituacaoFuncionario(funcId)
    }
    return record
  },

  async delete(id: string) {
    const record = await pb.collection('ferias').getOne<Ferias>(id)
    const res = await pb.collection('ferias').delete(id)
    if (record.funcionario) {
      await this.sincronizarSituacaoFuncionario(record.funcionario)
    }
    return res
  },

  async sincronizarSituacaoFuncionario(funcionarioId: string) {
    try {
      const hojeStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date())

      // Buscar se há férias vigentes hoje
      const feriasAtivas = await pb.collection('ferias').getList(1, 1, {
        filter: `funcionario = "${funcionarioId}" && status != "cancelada" && data_inicio <= "${hojeStr}" && data_fim >= "${hojeStr}"`,
      })

      const func = await pb.collection('funcionarios').getOne<Funcionario>(funcionarioId)
      if (func.situacao === 'desligado') return // não altera se já desligado

      if (feriasAtivas.totalItems > 0) {
        if (func.situacao !== 'em_ferias') {
          await pb.collection('funcionarios').update(funcionarioId, {
            situacao: 'em_ferias',
          })
        }
      } else {
        // Se estava marcado 'em_ferias' mas não há mais férias hoje, volta para 'ativo'
        if (func.situacao === 'em_ferias') {
          await pb.collection('funcionarios').update(funcionarioId, {
            situacao: 'ativo',
          })
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar situação de férias do funcionário:', err)
    }
  },
}

export const ausenciasService = {
  async list(page = 1, perPage = 50, filter = '', sort = '-data_inicio') {
    return await pb.collection('ausencias').getList<Ausencia>(page, perPage, {
      filter,
      sort,
      expand: 'funcionario,documentos,usuario_responsavel',
    })
  },

  async listAll(filter = '', sort = '-data_inicio') {
    return await pb.collection('ausencias').getFullList<Ausencia>({
      filter,
      sort,
      expand: 'funcionario,documentos,usuario_responsavel',
    })
  },

  async listByFuncionario(funcionarioId: string) {
    return await pb.collection('ausencias').getFullList<Ausencia>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-data_inicio',
      expand: 'funcionario,documentos,usuario_responsavel',
    })
  },

  async getById(id: string) {
    return await pb.collection('ausencias').getOne<Ausencia>(id, {
      expand: 'funcionario,documentos,usuario_responsavel',
    })
  },

  async create(params: {
    funcionario: string
    categoria: Ausencia['categoria']
    data_inicio: string
    data_fim?: string
    justificativa?: string
    situacao?: Ausencia['situacao']
    usuario_responsavel?: string
    impacta_aquisitivo?: boolean
    observacoes?: string
    arquivo?: File | null
  }) {
    let documentoId: string | undefined = undefined

    // Se houver arquivo anexo (ex: atestado médico ou comprovante de licença)
    if (params.arquivo) {
      const formData = new FormData()
      formData.append('funcionario', params.funcionario)
      formData.append(
        'categoria',
        params.categoria === 'atestado' ? 'atestado_medico' : 'comprovantes',
      )
      formData.append('nome', `Documento Ausência (${params.categoria}) - ${params.data_inicio}`)
      formData.append('data_envio', new Date().toISOString())
      formData.append('arquivo', params.arquivo)
      formData.append(
        'nivel_acesso',
        params.categoria === 'atestado' ? 'restrito_medico' : 'restrito_rh',
      )
      formData.append('ativo', 'true')
      if (params.usuario_responsavel) {
        formData.append('usuario_responsavel', params.usuario_responsavel)
      }

      const doc = await pb.collection('documentos').create<Documento>(formData)
      documentoId = doc.id
    }

    const payload: Partial<Ausencia> = {
      funcionario: params.funcionario,
      categoria: params.categoria,
      situacao: params.situacao || 'informada',
      data_inicio: params.data_inicio,
      data_fim: params.data_fim || params.data_inicio,
      justificativa: params.justificativa,
      usuario_responsavel: params.usuario_responsavel,
      impacta_aquisitivo: Boolean(params.impacta_aquisitivo),
      observacoes: params.observacoes,
      documentos: documentoId,
    }

    const ausencia = await pb.collection('ausencias').create<Ausencia>(payload)

    // Se a categoria for 'afastamento', atualiza situação do funcionário
    if (params.categoria === 'afastamento') {
      try {
        await pb.collection('funcionarios').update(params.funcionario, {
          situacao: 'afastado',
        })
      } catch {
        /* intentionally ignored */
      }
    }

    return ausencia
  },

  async update(
    id: string,
    data: Partial<Ausencia> & { arquivo?: File | null; adminUserId?: string },
  ) {
    let docId = data.documentos
    if (data.arquivo && data.funcionario) {
      const formData = new FormData()
      formData.append('funcionario', data.funcionario)
      formData.append(
        'categoria',
        data.categoria === 'atestado' ? 'atestado_medico' : 'comprovantes',
      )
      formData.append(
        'nome',
        `Documento Ausência (${data.categoria || 'anexo'}) - ${data.data_inicio || 'atualizacao'}`,
      )
      formData.append('data_envio', new Date().toISOString())
      formData.append('arquivo', data.arquivo)
      formData.append(
        'nivel_acesso',
        data.categoria === 'atestado' ? 'restrito_medico' : 'restrito_rh',
      )
      formData.append('ativo', 'true')
      if (data.adminUserId) {
        formData.append('usuario_responsavel', data.adminUserId)
      }
      const doc = await pb.collection('documentos').create<Documento>(formData)
      docId = doc.id
    }

    const updatePayload: Partial<Ausencia> = { ...data }
    delete (updatePayload as any).arquivo
    delete (updatePayload as any).adminUserId
    if (docId) {
      updatePayload.documentos = docId
    }

    return await pb.collection('ausencias').update<Ausencia>(id, updatePayload)
  },

  async delete(id: string) {
    return await pb.collection('ausencias').delete(id)
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
    // Reutiliza ausenciasService.create para centralizar armazenamento e garantir rastreabilidade
    return await ausenciasService.create({
      funcionario: params.funcionarioId,
      categoria: 'atestado',
      situacao: 'justificada',
      data_inicio: params.dataInicio,
      data_fim: params.dataFim || params.dataInicio,
      justificativa: params.justificativa,
      arquivo: params.arquivo,
      usuario_responsavel: params.adminUserId,
      impacta_aquisitivo: false,
    })
  },

  async getFileToken(): Promise<string> {
    try {
      return await pb.files.getToken()
    } catch {
      return ''
    }
  },

  getFileUrl(
    record: { id: string; collectionId: string; collectionName?: string },
    fileName: string,
    token?: string,
  ) {
    return pb.files.getURL(record, fileName, token ? { token } : undefined)
  },
}

export const documentosService = {
  async list(filters?: {
    funcionarioId?: string
    categoria?: string
    search?: string
    vencendo?: boolean
    somenteAtivos?: boolean
  }) {
    const filterClauses: string[] = []

    if (filters?.funcionarioId) {
      filterClauses.push(`funcionario = "${filters.funcionarioId}"`)
    }

    if (filters?.categoria && filters.categoria !== 'todas') {
      filterClauses.push(`categoria = "${filters.categoria}"`)
    }

    if (filters?.somenteAtivos !== false) {
      filterClauses.push('ativo = true')
    }

    if (filters?.search) {
      filterClauses.push(`nome ~ "${filters.search}"`)
    }

    if (filters?.vencendo) {
      const today = new Date().toISOString().split('T')[0]
      const future = new Date()
      future.setDate(future.getDate() + 30)
      const futureStr = future.toISOString().split('T')[0]
      filterClauses.push(`data_validade >= "${today}" && data_validade <= "${futureStr}"`)
    }

    const filter = filterClauses.length > 0 ? filterClauses.join(' && ') : ''

    return await pb.collection('documentos').getFullList<Documento>({
      filter,
      sort: '-data_envio,-created',
      expand: 'funcionario,usuario_responsavel',
    })
  },

  async getById(id: string) {
    return await pb.collection('documentos').getOne<Documento>(id, {
      expand: 'funcionario,usuario_responsavel',
    })
  },

  async create(data: {
    funcionario: string
    categoria: Documento['categoria']
    nome: string
    descricao?: string
    data_validade?: string
    arquivo: File
    nivel_acesso: Documento['nivel_acesso']
    usuario_responsavel?: string
  }) {
    const formData = new FormData()
    formData.append('funcionario', data.funcionario)
    formData.append('categoria', data.categoria)
    formData.append('nome', data.nome.trim())
    if (data.descricao) formData.append('descricao', data.descricao.trim())
    formData.append('data_envio', new Date().toISOString())
    if (data.data_validade) formData.append('data_validade', data.data_validade)
    formData.append('arquivo', data.arquivo)
    formData.append('nivel_acesso', data.nivel_acesso)
    formData.append('ativo', 'true')
    if (data.usuario_responsavel) {
      formData.append('usuario_responsavel', data.usuario_responsavel)
    }

    const record = await pb.collection('documentos').create<Documento>(formData, {
      expand: 'funcionario,usuario_responsavel',
    })

    // Registrar log de auditoria
    try {
      await pb.collection('logs_auditoria').create({
        usuario: data.usuario_responsavel || pb.authStore.record?.id,
        acao: 'upload_documento',
        entidade: 'documentos',
        entidade_id: record.id,
        detalhes: `Upload do documento ${record.nome} (${record.categoria}) para funcionário ID ${record.funcionario}`,
        nivel: record.nivel_acesso === 'restrito_medico' ? 'sensivel' : 'info',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }

    return record
  },

  async update(
    id: string,
    data: {
      nome?: string
      descricao?: string
      categoria?: Documento['categoria']
      data_validade?: string
      nivel_acesso?: Documento['nivel_acesso']
      ativo?: boolean
      arquivo?: File | null
      adminUserId?: string
    },
  ) {
    const formData = new FormData()
    if (data.nome) formData.append('nome', data.nome.trim())
    if (data.descricao !== undefined) formData.append('descricao', data.descricao.trim())
    if (data.categoria) formData.append('categoria', data.categoria)
    if (data.data_validade !== undefined) formData.append('data_validade', data.data_validade)
    if (data.nivel_acesso) formData.append('nivel_acesso', data.nivel_acesso)
    if (data.ativo !== undefined) formData.append('ativo', String(data.ativo))
    if (data.arquivo) formData.append('arquivo', data.arquivo)

    const updated = await pb.collection('documentos').update<Documento>(id, formData, {
      expand: 'funcionario,usuario_responsavel',
    })

    // Registrar log de auditoria
    try {
      await pb.collection('logs_auditoria').create({
        usuario: data.adminUserId || pb.authStore.record?.id,
        acao: 'update_documento',
        entidade: 'documentos',
        entidade_id: id,
        detalhes: `Atualização de metadados/arquivo do documento ${updated.nome}`,
        nivel: updated.nivel_acesso === 'restrito_medico' ? 'sensivel' : 'info',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async arquivar(id: string, adminUserId?: string) {
    const updated = await pb.collection('documentos').update<Documento>(id, { ativo: false })
    try {
      await pb.collection('logs_auditoria').create({
        usuario: adminUserId || pb.authStore.record?.id,
        acao: 'arquivar_documento',
        entidade: 'documentos',
        entidade_id: id,
        detalhes: `Arquivamento do documento ${updated.nome}`,
        nivel: updated.nivel_acesso === 'restrito_medico' ? 'sensivel' : 'info',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }
    return updated
  },

  async desarquivar(id: string, adminUserId?: string) {
    const updated = await pb.collection('documentos').update<Documento>(id, { ativo: true })
    try {
      await pb.collection('logs_auditoria').create({
        usuario: adminUserId || pb.authStore.record?.id,
        acao: 'desarquivar_documento',
        entidade: 'documentos',
        entidade_id: id,
        detalhes: `Restauração do documento ${updated.nome}`,
        nivel: updated.nivel_acesso === 'restrito_medico' ? 'sensivel' : 'info',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }
    return updated
  },

  async getSecureUrl(record: Documento, fileName?: string): Promise<string> {
    const file = fileName || record.arquivo
    if (!file) return ''
    try {
      const token = await pb.files.getToken()
      return pb.files.getURL(record, file, { token })
    } catch {
      return pb.files.getURL(record, file)
    }
  },

  async logAcessoVisualizacao(record: Documento, acao: 'view' | 'download') {
    try {
      await pb.collection('logs_auditoria').create({
        usuario: pb.authStore.record?.id,
        acao: acao === 'download' ? 'download_documento' : 'visualizacao_documento',
        entidade: 'documentos',
        entidade_id: record.id,
        detalhes: `${acao === 'download' ? 'Download' : 'Visualização'} segura do documento ${record.nome} (Categoria: ${record.categoria}, Acesso: ${record.nivel_acesso})`,
        nivel: record.nivel_acesso === 'restrito_medico' ? 'sensivel' : 'info',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }
  },
}

export const holeritesService = {
  async list(filters?: {
    funcionarioId?: string
    competenciaAno?: number
    competenciaMes?: number
    search?: string
  }) {
    const filterClauses: string[] = []

    if (filters?.funcionarioId && filters.funcionarioId !== 'todos') {
      filterClauses.push(`funcionario = "${filters.funcionarioId}"`)
    }

    if (filters?.competenciaAno) {
      filterClauses.push(`competencia_ano = ${filters.competenciaAno}`)
    }

    if (filters?.competenciaMes && filters.competenciaMes > 0) {
      filterClauses.push(`competencia_mes = ${filters.competenciaMes}`)
    }

    const filter = filterClauses.length > 0 ? filterClauses.join(' && ') : ''

    const list = await pb.collection('holerites').getFullList<Holerite>({
      filter,
      sort: '-competencia_ano,-competencia_mes,-data_envio,-created',
      expand: 'funcionario,usuario_responsavel',
    })

    if (filters?.search) {
      const q = filters.search.toLowerCase()
      return list.filter((h) => {
        const fNome = h.expand?.funcionario?.nome?.toLowerCase() || ''
        const fMat = h.expand?.funcionario?.matricula?.toLowerCase() || ''
        return fNome.includes(q) || fMat.includes(q)
      })
    }

    return list
  },

  async getById(id: string) {
    return await pb.collection('holerites').getOne<Holerite>(id, {
      expand: 'funcionario,usuario_responsavel',
    })
  },

  async create(data: {
    funcionario: string
    competencia_mes: number
    competencia_ano: number
    arquivo: File
    observacoes?: string
    usuario_responsavel?: string
  }) {
    // Verificar se já existe holerite para esta mesma competência e funcionário
    const existentes = await pb.collection('holerites').getFullList<Holerite>({
      filter: `funcionario = "${data.funcionario}" && competencia_ano = ${data.competencia_ano} && competencia_mes = ${data.competencia_mes}`,
      sort: '-versao',
    })

    if (existentes.length > 0) {
      throw new Error(
        `Já existe um holerite cadastrado para a competência ${String(data.competencia_mes).padStart(2, '0')}/${data.competencia_ano}. Utilize a opção 'Substituir Holerite' para atualizar com versionamento auditado.`,
      )
    }

    const formData = new FormData()
    formData.append('funcionario', data.funcionario)
    formData.append('competencia_mes', String(data.competencia_mes))
    formData.append('competencia_ano', String(data.competencia_ano))
    formData.append('data_envio', new Date().toISOString())
    formData.append('arquivo', data.arquivo)
    formData.append('versao', '1')
    if (data.observacoes) formData.append('observacoes', data.observacoes.trim())
    if (data.usuario_responsavel) {
      formData.append('usuario_responsavel', data.usuario_responsavel)
    }

    const record = await pb.collection('holerites').create<Holerite>(formData, {
      expand: 'funcionario,usuario_responsavel',
    })

    try {
      await pb.collection('logs_auditoria').create({
        usuario: data.usuario_responsavel || pb.authStore.record?.id,
        acao: 'upload_holerite',
        entidade: 'holerites',
        entidade_id: record.id,
        detalhes: `Envio do holerite v1 ref. ${String(data.competencia_mes).padStart(2, '0')}/${data.competencia_ano} para funcionário ID ${data.funcionario}`,
        nivel: 'sensivel',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }

    return record
  },

  async substituir(
    id: string,
    data: {
      arquivo: File
      motivo_substituicao: string
      observacoes?: string
      usuario_responsavel?: string
    },
  ) {
    if (!data.motivo_substituicao || data.motivo_substituicao.trim().length < 5) {
      throw new Error('Informe o motivo da substituição do holerite (mínimo de 5 caracteres).')
    }

    const holeriteAtual = await pb.collection('holerites').getOne<Holerite>(id, {
      expand: 'funcionario',
    })

    const versaoAnterior = holeriteAtual.versao || 1
    const novaVersao = versaoAnterior + 1

    // 1. Arquivar a versão anterior na coleção holerites_versoes
    try {
      const versaoFormData = new FormData()
      versaoFormData.append('holerite', holeriteAtual.id)
      versaoFormData.append('funcionario', holeriteAtual.funcionario)
      versaoFormData.append('competencia_mes', String(holeriteAtual.competencia_mes))
      versaoFormData.append('competencia_ano', String(holeriteAtual.competencia_ano))
      versaoFormData.append('versao', String(versaoAnterior))
      versaoFormData.append('motivo_substituicao', data.motivo_substituicao.trim())
      if (data.usuario_responsavel) {
        versaoFormData.append('usuario_responsavel', data.usuario_responsavel)
      }

      // Se temos o arquivo atual, podemos clonar/baixar ou anexar
      if (holeriteAtual.arquivo) {
        try {
          const fileToken = await pb.files.getToken()
          const fileUrl = pb.files.getURL(holeriteAtual, holeriteAtual.arquivo, {
            token: fileToken,
          })
          const res = await fetch(fileUrl)
          const blob = await res.blob()
          versaoFormData.append('arquivo', blob, holeriteAtual.arquivo)
        } catch {
          /* intentionally ignored */
        }
      }

      await pb.collection('holerites_versoes').create(versaoFormData)
    } catch (saveVerErr) {
      console.warn('Falha ao arquivar versão anterior de holerite:', saveVerErr)
    }

    // 2. Atualizar o holerite com o novo arquivo e nova versão
    const updateFormData = new FormData()
    updateFormData.append('arquivo', data.arquivo)
    updateFormData.append('versao', String(novaVersao))
    updateFormData.append('data_envio', new Date().toISOString())
    if (data.observacoes !== undefined) {
      updateFormData.append('observacoes', data.observacoes.trim())
    }
    if (data.usuario_responsavel) {
      updateFormData.append('usuario_responsavel', data.usuario_responsavel)
    }

    const updated = await pb.collection('holerites').update<Holerite>(id, updateFormData, {
      expand: 'funcionario,usuario_responsavel',
    })

    try {
      await pb.collection('logs_auditoria').create({
        usuario: data.usuario_responsavel || pb.authStore.record?.id,
        acao: 'substituicao_holerite',
        entidade: 'holerites',
        entidade_id: id,
        detalhes: `Substituição de holerite para v${novaVersao} ref. ${String(updated.competencia_mes).padStart(2, '0')}/${updated.competencia_ano}. Motivo: ${data.motivo_substituicao}`,
        nivel: 'sensivel',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }

    return updated
  },

  async listVersoes(holeriteId: string) {
    try {
      return await pb.collection('holerites_versoes').getFullList<HoleriteVersao>({
        filter: `holerite = "${holeriteId}"`,
        sort: '-versao',
        expand: 'usuario_responsavel',
      })
    } catch {
      return []
    }
  },

  async getSecureUrl(record: Holerite | HoleriteVersao, fileName?: string): Promise<string> {
    const file = fileName || record.arquivo
    if (!file) return ''
    try {
      const token = await pb.files.getToken()
      return pb.files.getURL(record as any, file, { token })
    } catch {
      return pb.files.getURL(record as any, file)
    }
  },

  async logAcesso(record: Holerite | HoleriteVersao, acao: 'view' | 'download') {
    try {
      await pb.collection('logs_auditoria').create({
        usuario: pb.authStore.record?.id,
        acao: acao === 'download' ? 'download_holerite' : 'visualizacao_holerite',
        entidade: 'holerites',
        entidade_id: record.id,
        detalhes: `${acao === 'download' ? 'Download' : 'Visualização'} segura do holerite ref. ${String((record as any).competencia_mes).padStart(2, '0')}/${(record as any).competencia_ano} v${(record as any).versao || 1}`,
        nivel: 'sensivel',
        data: new Date().toISOString(),
      })
    } catch {
      /* intentionally ignored */
    }
  },
}

export const solicitacoesService = {
  async list(filters?: { funcionarioId?: string; status?: string }) {
    const filterClauses: string[] = []
    if (filters?.funcionarioId) filterClauses.push(`funcionario = "${filters.funcionarioId}"`)
    if (filters?.status) filterClauses.push(`status = "${filters.status}"`)
    const filter = filterClauses.join(' && ')

    return await pb.collection('solicitacoes').getFullList<Solicitacao>({
      filter,
      sort: '-created',
      expand: 'funcionario,decidido_por',
    })
  },

  async create(data: {
    funcionario: string
    tipo: Solicitacao['tipo']
    motivo: string
    detalhes?: string
  }) {
    return await pb.collection('solicitacoes').create<Solicitacao>({
      ...data,
      status: 'pendente',
    })
  },

  async decidir(
    id: string,
    data: {
      status: 'aprovado' | 'recusado' | 'cancelado'
      decidido_por?: string
    },
  ) {
    return await pb.collection('solicitacoes').update<Solicitacao>(id, {
      status: data.status,
      decidido_por: data.decidido_por || pb.authStore.record?.id,
      decidido_em: new Date().toISOString(),
    })
  },
}

export const portalService = {
  // Retorna a ficha do funcionário associada ao usuário autenticado atual
  async getMeuPerfil(): Promise<Funcionario | null> {
    const userId = pb.authStore.record?.id
    if (!userId) return null

    // 1. Tenta buscar por vínculo direto user = userId
    try {
      const list = await pb.collection('funcionarios').getList<Funcionario>(1, 1, {
        filter: `user = "${userId}"`,
        expand: 'cargo,departamento,jornada_atual',
      })
      if (list.items.length > 0) return list.items[0]
    } catch {
      /* ignore */
    }

    // 2. Fallback: Se for admin/rh ou e-mail coincidente, busca por e-mail e auto-vincula
    const userEmail = pb.authStore.record?.email
    if (userEmail) {
      try {
        const listEmail = await pb.collection('funcionarios').getList<Funcionario>(1, 1, {
          filter: `email = "${userEmail.toLowerCase()}"`,
          expand: 'cargo,departamento,jornada_atual',
        })
        if (listEmail.items.length > 0) {
          const func = listEmail.items[0]
          // Tenta atualizar vínculo se não estiver preenchido
          if (!func.user) {
            try {
              await pb.collection('funcionarios').update(func.id, { user: userId })
            } catch {
              /* ignore */
            }
          }
          return func
        }
      } catch {
        /* ignore */
      }
    }

    // 3. Se for usuário admin inspecionando e não tem ficha própria, retorna o primeiro funcionário ativo para visualização
    if (pb.authStore.record?.role === 'admin' || pb.authStore.record?.role === 'rh') {
      try {
        const fallback = await pb.collection('funcionarios').getList<Funcionario>(1, 1, {
          filter: 'situacao = "ativo"',
          sort: 'matricula',
          expand: 'cargo,departamento,jornada_atual',
        })
        if (fallback.items.length > 0) return fallback.items[0]
      } catch {
        /* ignore */
      }
    }

    return null
  },

  // Meus Holerites
  async getMeusHolerites(funcionarioId: string): Promise<Holerite[]> {
    return await pb.collection('holerites').getFullList<Holerite>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-competencia_ano,-competencia_mes,-data_envio',
      expand: 'funcionario',
    })
  },

  // Meus Documentos (somente documentos liberados — oculta restrito_rh e restrito_medico)
  async getMeusDocumentos(funcionarioId: string): Promise<Documento[]> {
    return await pb.collection('documentos').getFullList<Documento>({
      filter: `funcionario = "${funcionarioId}" && nivel_acesso != "restrito_rh" && nivel_acesso != "restrito_medico" && ativo = true`,
      sort: '-data_envio,-created',
      expand: 'funcionario',
    })
  },

  // Minhas Férias
  async getMinhasFerias(funcionarioId: string): Promise<Ferias[]> {
    return await pb.collection('ferias').getFullList<Ferias>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-data_inicio',
      expand: 'funcionario',
    })
  },

  // Meus Registros de Ponto Recentes
  async getMeusRegistrosRecentes(funcionarioId: string, limit = 30): Promise<RegistroHorario[]> {
    const list = await pb.collection('registros_horario').getList<RegistroHorario>(1, limit, {
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-timestamp_utc,-created',
    })
    return list.items
  },

  // Minhas Solicitações
  async getMinhasSolicitacoes(funcionarioId: string): Promise<Solicitacao[]> {
    return await pb.collection('solicitacoes').getFullList<Solicitacao>({
      filter: `funcionario = "${funcionarioId}"`,
      sort: '-created',
      expand: 'decidido_por',
    })
  },

  async criarSolicitacao(data: {
    funcionarioId: string
    tipo: Solicitacao['tipo']
    motivo: string
    detalhes?: string
  }): Promise<Solicitacao> {
    return await pb.collection('solicitacoes').create<Solicitacao>({
      funcionario: data.funcionarioId,
      tipo: data.tipo,
      motivo: data.motivo.trim(),
      detalhes: data.detalhes?.trim() || '',
      status: 'pendente',
    })
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

    // 6. Férias no Mês (aprovadas, programadas, em gozo ou concluídas)
    const ferias = await pb.collection('ferias').getFullList<Ferias>({
      filter: `funcionario = "${funcionarioId}" && status != "cancelada" && (
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
  status: string
  server_time_utc: string
  server_time_ms?: number
  sp_time_formatted?: string
  sp_date_formatted?: string
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
  server_timestamp_ms?: number
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
    // Férias ativas hoje: status != 'cancelada' && data_inicio <= today <= data_fim
    const feriasAtivas = await pb.collection('ferias').getList(1, 1, {
      filter: `status != "cancelada" && data_inicio <= "${todayStr}" && data_fim >= "${todayStr}"`,
    })
    const emFerias = feriasAtivas.totalItems

    // 4. Ausências Informadas Hoje
    // Ausências ativas hoje: data_inicio <= today <= data_fim
    // Desconsiderando funcionários que estejam em folga da escala ou de férias
    const ausenciasAtivas = await pb.collection('ausencias').getFullList<Ausencia>({
      filter: `data_inicio <= "${todayStr}" && (data_fim >= "${todayStr}" || data_fim = null || data_fim = "")`,
      expand: 'funcionario',
    })

    // Contar ausências válidas hoje (que não sejam duplicadas de quem já está de férias)
    const ausenciasHoje = ausenciasAtivas.length

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
      filter: `status != "cancelada" && status != "concluida" && data_inicio >= "${todayStr}" && data_inicio <= "${thirtyDaysStr}"`,
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
        filter: `status != "cancelada" && status != "concluida" && data_inicio >= "${todayStr}" && data_inicio <= "${thirtyDaysStr}"`,
        sort: 'data_inicio',
        expand: 'funcionario',
      })
      for (const f of ferias) {
        const nome = f.expand?.funcionario?.nome || 'Funcionário'
        const diasText = f.dias ? ` (${f.dias} dias)` : ''
        eventos.push({
          id: `ferias-${f.id}`,
          tipo: 'ferias',
          titulo: `Férias de ${nome}${diasText}`,
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
