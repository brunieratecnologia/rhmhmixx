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

  async create(data: Partial<Jornada>) {
    return await pb.collection('jornadas').create<Jornada>(data)
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

export const dashboardService = {
  async getMetrics() {
    // 1. Total de Funcionários Ativos
    const ativosRes = await pb.collection('funcionarios').getList(1, 1, {
      filter: 'situacao = "ativo"',
    })
    const totalAtivos = ativosRes.totalItems

    // 2. Entradas Registradas Hoje
    // Using UTC date of today
    const todayStr = new Date().toISOString().split('T')[0]
    const hojeRegistros = await pb.collection('registros_horario').getFullList<RegistroHorario>({
      filter: `data_utc >= "${todayStr}" || timestamp_utc >= "${todayStr} 00:00:00"`,
      expand: 'funcionario',
    })
    const distinctHojeFuncs = new Set(hojeRegistros.map((r) => r.funcionario))
    const entradasHoje = distinctHojeFuncs.size

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
    const todayStr = new Date().toISOString().split('T')[0]
    try {
      const registros = await pb.collection('registros_horario').getList<RegistroHorario>(1, 20, {
        filter: `data_utc >= "${todayStr}" || timestamp_utc >= "${todayStr} 00:00:00"`,
        sort: '-timestamp_utc,-created',
        expand: 'funcionario',
      })
      return registros.items
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
