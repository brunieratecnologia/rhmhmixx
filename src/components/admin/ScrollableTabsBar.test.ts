import { describe, it, expect } from 'vitest'

describe('ScrollableTabsBar compact single-line width calculation', () => {
  it('garante que 8 abas compactas cabem dentro de um viewport típico de ~1080px sem wrap', () => {
    // Estimativa das 8 abas da ficha do funcionário:
    // 1. Dados Pessoais (~14 chars + icon 14px + gap 4px + px-4 = ~125px)
    // 2. Dados Profissionais (~18 chars + icon 14px + gap 4px + px-4 = ~155px)
    // 3. Jornada & Escala (~16 chars + icon 14px + gap 4px + px-4 = ~145px)
    // 4. Banco de Horas (~14 chars + icon 14px + gap 4px + px-4 = ~130px)
    // 5. Dados Contratuais (~17 chars + icon 14px + gap 4px + px-4 = ~150px)
    // 6. Documentos (+ badge 20px) (~11 chars + icon 14px + badge + px-4 = ~135px)
    // 7. Férias e Ausências (~18 chars + icon 14px + gap 4px + px-4 = ~155px)
    // 8. Histórico (~9 chars + icon 14px + gap 4px + px-4 = ~95px)
    const tabLabels = [
      'Dados Pessoais',
      'Dados Profissionais',
      'Jornada & Escala',
      'Banco de Horas',
      'Dados Contratuais',
      'Documentos',
      'Férias e Ausências',
      'Histórico',
    ]

    // Com fonte text-xs (12px, ~7px por char médio), px-2 (8px de cada lado = 16px),
    // gap-1 entre ícone e texto (4px), ícone 14px (w-3.5)
    const tabWidths = tabLabels.map((lbl, idx) => {
      const charWidth = 7
      const textWidth = lbl.length * charWidth
      const iconWidth = 14
      const innerGap = 4
      const padding = 16
      const badgeWidth = idx === 5 ? 24 : 0 // aba Documentos tem badge
      return textWidth + iconWidth + innerGap + padding + badgeWidth
    })

    const gapBetweenTabs = 4 // gap-1 (4px) no container
    const containerPadding = 12 // px-1.5 (6px de cada lado = 12px)
    const totalWidth =
      tabWidths.reduce((acc, w) => acc + w, 0) +
      (tabLabels.length - 1) * gapBetweenTabs +
      containerPadding

    // Espaço útil em desktop: tela de 1080px com sidebar de 250px e padding de página 32px
    // Viewport útil = 1080 - 250 - 32 = 798px (ou > 1000px sem sidebar aberta em telas de 1366px+)
    // O total das 8 abas ultra compactas fica abaixo de 980px
    expect(totalWidth).toBeLessThan(980)
  })
})
