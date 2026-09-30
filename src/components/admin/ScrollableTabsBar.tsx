import React from 'react'
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

  return (
    <div className={cn('relative border-b border-slate-200 bg-white select-none', className)}>
      {/* Container com flex-wrap: todas as abas visíveis sem estouro lateral ou barra de rolagem */}
      <div className="flex flex-wrap items-center px-2 sm:px-3 lg:px-4 pt-1.5 gap-x-1 sm:gap-x-1.5 md:gap-x-2 gap-y-1">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'group relative py-2 px-2 sm:px-2.5 text-xs sm:text-[13px] font-semibold flex items-center gap-1.5 border-b-2 transition-all duration-150 cursor-pointer focus:outline-hidden shrink-0',
                isActive
                  ? 'border-[#D4AF37] text-slate-900 font-bold bg-[#D4AF37]/5 rounded-t-md'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50/60 rounded-t-md',
              )}
            >
              {tab.icon && (
                <span
                  className={cn(
                    'transition-colors shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5 sm:[&>svg]:w-4 sm:[&>svg]:h-4',
                    isActive ? 'text-[#D4AF37]' : 'text-slate-400 group-hover:text-slate-600',
                  )}
                >
                  {tab.icon}
                </span>
              )}
              <span className="tracking-tight whitespace-nowrap">{tab.label}</span>
              {tab.badge}
            </button>
          )
        })}
      </div>
    </div>
  )
}
