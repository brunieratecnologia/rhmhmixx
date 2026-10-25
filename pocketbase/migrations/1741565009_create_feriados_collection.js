migrate(
  (app) => {
    // 1. Criar coleção 'feriados' se não existir
    let feriadosCol
    try {
      feriadosCol = app.findCollectionByNameOrId('feriados')
    } catch (_) {
      feriadosCol = new Collection({
        name: 'feriados',
        type: 'base',
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.role = "admin" || @request.auth.role = "rh"',
        updateRule: '@request.auth.role = "admin" || @request.auth.role = "rh"',
        deleteRule: '@request.auth.role = "admin" || @request.auth.role = "rh"',
        fields: [
          { name: 'data', type: 'date', required: true },
          { name: 'nome', type: 'text', required: true },
          {
            name: 'tipo',
            type: 'select',
            required: true,
            values: ['nacional', 'estadual', 'municipal', 'empresa'],
            maxSelect: 1,
          },
          { name: 'recorrente', type: 'bool' },
          { name: 'ativo', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_feriados_data ON feriados (data)'],
      })
      app.save(feriadosCol)
    }

    // 2. Pré-cadastrar os feriados nacionais brasileiros fixos de 2026 como recorrentes
    // Feriados fixos nacionais:
    // 01/01 Confraternização Universal
    // 21/04 Tiradentes
    // 01/05 Dia do Trabalho
    // 07/09 Independência do Brasil
    // 12/10 Nossa Senhora Aparecida
    // 02/11 Finados
    // 15/11 Proclamação da República
    // 20/11 Dia Nacional de Zumbi e da Consciência Negra (Lei nº 14.759/2023)
    // 25/12 Natal
    const feriadosFixos2026 = [
      {
        data: '2026-01-01',
        nome: 'Confraternização Universal',
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
      },
      { data: '2026-04-21', nome: 'Tiradentes', tipo: 'nacional', recorrente: true, ativo: true },
      {
        data: '2026-05-01',
        nome: 'Dia do Trabalho',
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
      },
      {
        data: '2026-09-07',
        nome: 'Independência do Brasil',
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
      },
      {
        data: '2026-10-12',
        nome: 'Nossa Senhora Aparecida',
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
      },
      { data: '2026-11-02', nome: 'Finados', tipo: 'nacional', recorrente: true, ativo: true },
      {
        data: '2026-11-15',
        nome: 'Proclamação da República',
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
      },
      {
        data: '2026-11-20',
        nome: 'Dia Nacional de Zumbi e da Consciência Negra',
        tipo: 'nacional',
        recorrente: true,
        ativo: true,
      },
      { data: '2026-12-25', nome: 'Natal', tipo: 'nacional', recorrente: true, ativo: true },
    ]

    for (const f of feriadosFixos2026) {
      try {
        const existing = app.findRecordsByFilter('feriados', `data ~ '${f.data}'`, '', 1, 0)
        if (existing.length === 0) {
          const record = new Record(feriadosCol)
          record.set('data', `${f.data} 00:00:00.000Z`)
          record.set('nome', f.nome)
          record.set('tipo', f.tipo)
          record.set('recorrente', f.recorrente)
          record.set('ativo', f.ativo)
          app.save(record)
        }
      } catch (err) {
        console.log(`Erro ao pré-cadastrar feriado ${f.nome}:`, err)
      }
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('feriados')
      app.delete(col)
    } catch (_) {}
  },
)
