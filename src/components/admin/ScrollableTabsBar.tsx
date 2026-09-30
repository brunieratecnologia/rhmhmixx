import React, { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ScrollableTabItem<T extends string = string> {
  id: T
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  hidden?: boolean
}

interface ScrollableTabsBarProps<T extends string = string> {
  tabs: ScrollableTabItem<T>[]
  activeTab: T
  onTabChange: (tabId: T) => void
  className?: string
}

export function ScrollableTabsBar<T extends string = string>({
  tabs,
  activeTab,
  onTabChange,
  className,
}: ScrollableTabsBarProps<T>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const visibleTabs = tabs.filter((t) => !t.hidden)

  const checkScrollState = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    // Pequena tolerância de 2px
    setCanScrollLeft(scrollLeft > 2)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    checkScrollState()

    const handleResize = () => checkScrollState()
    window.addEventListener('resize', handleResize)
    el.addEventListener('scroll', checkScrollState, { passive: true })

    // Observer de redimensionamento para quando fontes carregarem ou tamanho do container mudar
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkScrollState()
      })
      resizeObserver.observe(el)
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      el.removeEventListener('scroll', checkScrollState)
      resizeObserver?.disconnect()
    }
  }, [checkScrollState, visibleTabs.length])

  // Rolar automaticamente para garantir que a aba ativa esteja no campo de visão
  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return

    const activeButton = el.querySelector<HTMLButtonElement>(`[data-tab-id="${activeTab}"]`)
    if (activeButton) {
      const containerLeft = el.scrollLeft
      const containerRight = containerLeft + el.clientWidth
      const btnLeft = activeButton.offsetLeft
      const btnRight = btnLeft + activeButton.offsetWidth

      if (btnLeft < containerLeft) {
        el.scrollTo({ left: Math.max(0, btnLeft - 24), behavior: 'smooth' })
      } else if (btnRight > containerRight) {
        el.scrollTo({
          left: btnRight - el.clientWidth + 24,
          behavior: 'smooth',
        })
      }
    }
    checkScrollState()
  }, [activeTab, checkScrollState])

  const scrollByAmount = (offset: number) => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative border-b border-slate-200 bg-white select-none', className)}>
      {/* Botão de rolagem para esquerda (visível em desktop se puder rolar) */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollByAmount(-220)}
          aria-label="Rolar abas para a esquerda"
          className="hidden sm:flex absolute left-0 top-0 bottom-0 z-20 w-8 items-center justify-center bg-gradient-to-r from-white via-white/95 to-transparent text-slate-600 hover:text-[#D4AF37] transition-colors focus:outline-hidden"
        >
          <div className="w-6 h-6 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center hover:border-[#D4AF37]">
            <ChevronLeft className="w-3.5 h-3.5" />
          </div>
        </button>
      )}

      {/* Indicador visual de fade esquerdo para mobile */}
      {canScrollLeft && (
        <div
          aria-hidden="true"
          className="sm:hidden pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-white to-transparent"
        />
      )}

      {/* Container com scroll horizontal sem scrollbar feia */}
      <div
        ref={scrollContainerRef}
        className="flex overflow-x-auto no-scrollbar scroll-smooth px-4 sm:px-6 pt-2 gap-2 sm:gap-4"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group relative pb-3 pt-1 px-2.5 sm:px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 whitespace-nowrap transition-all duration-150 shrink-0 cursor-pointer focus:outline-hidden',
                isActive
                  ? 'border-[#D4AF37] text-slate-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300',
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    'transition-colors',
                    isActive ? 'text-[#D4AF37]' : 'text-slate-400 group-hover:text-slate-600',
                  )}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          )
        })}
      </div>

      {/* Indicador visual de fade direito para mobile */}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="sm:hidden pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-white to-transparent"
        />
      )}

      {/* Botão de rolagem para direita (visível em desktop se puder rolar) */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollByAmount(220)}
          aria-label="Rolar abas para a direita"
          className="hidden sm:flex absolute right-0 top-0 bottom-0 z-20 w-8 items-center justify-center bg-gradient-to-l from-white via-white/95 to-transparent text-slate-600 hover:text-[#D4AF37] transition-colors focus:outline-hidden"
        >
          <div className="w-6 h-6 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center hover:border-[#D4AF37]">
            <ChevronRight className="w-3.5 h-3.5" />
          </div>
        </button>
      )}
    </div>
  )
}
