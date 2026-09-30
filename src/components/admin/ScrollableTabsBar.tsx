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
  const visibleTabs = tabs.filter((t) => !t.hidden)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    // Tolerância de 2px para subpixel rendering
    setCanScrollLeft(scrollLeft > 2)
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return

    const handleScroll = () => updateScrollState()
    el.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', updateScrollState)

    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => updateScrollState())
      resizeObserver.observe(el)
    }

    return () => {
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', updateScrollState)
      resizeObserver?.disconnect()
    }
  }, [updateScrollState, visibleTabs.length])

  // Centraliza a aba ativa quando mudar
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const activeBtn = el.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`)
    if (activeBtn) {
      const containerLeft = el.getBoundingClientRect().left
      const btnLeft = activeBtn.getBoundingClientRect().left
      const offset = btnLeft - containerLeft - el.clientWidth / 2 + activeBtn.clientWidth / 2
      el.scrollBy({ left: offset, behavior: 'smooth' })
    }
  }, [activeTab])

  const scrollByAmount = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const delta = el.clientWidth * 0.6 * (direction === 'left' ? -1 : 1)
    el.scrollBy({ left: delta, behavior: 'smooth' })
  }

  return (
    <div className={cn('relative border-b border-slate-200 bg-white select-none', className)}>
      {/* Botão de rolagem para esquerda (visível apenas quando há overflow à esquerda, ex. telas móveis) */}
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Rolar abas para a esquerda"
          onClick={() => scrollByAmount('left')}
          className="absolute left-0 top-0 bottom-0 z-10 w-7 flex items-center justify-center bg-gradient-to-r from-white via-white/95 to-transparent text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Container de abas em LINHA ÚNICA (flex-nowrap) com espaçamento ultra-compacto */}
      <div
        ref={scrollRef}
        className="flex flex-nowrap items-center overflow-x-auto no-scrollbar px-1 sm:px-1.5 pt-1 gap-0.5 sm:gap-1"
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
                'group relative py-1.5 px-2 text-xs font-semibold flex items-center gap-1 border-b-2 transition-all duration-150 cursor-pointer focus:outline-hidden shrink-0 tracking-tight',
                isActive
                  ? 'border-[#D4AF37] text-slate-900 font-bold bg-[#D4AF37]/10 rounded-t-md shadow-xs'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50/70 rounded-t-md',
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    'transition-colors shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5',
                    isActive ? 'text-[#D4AF37]' : 'text-slate-400 group-hover:text-slate-600',
                  )}
                >
                  {tab.icon}
                </span>
              )}
              <span className="whitespace-nowrap leading-none">{tab.label}</span>
              {tab.badge}
            </button>
          )
        })}
      </div>

      {/* Botão de rolagem para direita (visível apenas quando há overflow à direita, ex. telas móveis) */}
      {canScrollRight && (
        <button
          type="button"
          aria-label="Rolar abas para a direita"
          onClick={() => scrollByAmount('right')}
          className="absolute right-0 top-0 bottom-0 z-10 w-7 flex items-center justify-center bg-gradient-to-l from-white via-white/95 to-transparent text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
