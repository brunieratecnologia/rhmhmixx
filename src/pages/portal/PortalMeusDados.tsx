import React from 'react'
import { useOutletContext } from 'react-router-dom'
import type { PortalContextType } from '@/pages/portal/PortalTypes'
import { formatBRDate, maskCPF, maskPhone } from '@/lib/formatters'
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Briefcase,
  Building,
  Clock,
  ShieldCheck,
  HeartHandshake,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

export default function PortalMeusDados() {
  const { funcionario } = useOutletContext<PortalContextType>()

  if (!funcionario) return null

  const initials = funcionario.nome.slice(0, 2).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Top Profile Card */}
      <div className="rounded-2xl bg-[#0F1624] border border-[#D4AF37]/30 p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 relative z-10">
          <Avatar className="w-24 h-24 rounded-2xl border-2 border-[#D4AF37]/60 shadow-lg">
            <AvatarImage src={funcionario.fotografia} />
            <AvatarFallback className="bg-[#D4AF37] text-slate-950 text-2xl font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-amber-100">{funcionario.nome}</h2>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
                {funcionario.situacao.toUpperCase()}
              </Badge>
            </div>

            <p className="text-sm text-[#D4AF37] font-medium">
              {funcionario.expand?.cargo?.nome || 'Cargo Não Atribuído'} •{' '}
              {funcionario.expand?.departamento?.nome || 'Departamento'}
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                Matrícula: <strong className="text-slate-200">{funcionario.matricula}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                Admissão:{' '}
                <strong className="text-slate-200">
                  {formatBRDate(funcionario.data_admissao)}
                </strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5 text-[#D4AF37]" />
                Vínculo:{' '}
                <strong className="text-slate-200">{funcionario.tipo_vinculo || 'CLT'}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Informações Pessoais & Contratuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dados Pessoais */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
          <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
            <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
              <User className="w-4 h-4 text-[#D4AF37]" />
              Dados Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Nome Completo</span>
              <span className="font-semibold text-slate-200 text-sm">{funcionario.nome}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">CPF</span>
              <span className="font-mono text-slate-200">{maskCPF(funcionario.cpf)}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Data de Nascimento</span>
              <span className="text-slate-200">{formatBRDate(funcionario.data_nascimento)}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">E-mail de Contato</span>
              <span className="text-slate-200 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3.5 h-3.5 text-[#D4AF37]" />
                {funcionario.email}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Telefone</span>
              <span className="text-slate-200 flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3.5 h-3.5 text-[#D4AF37]" />
                {maskPhone(funcionario.telefone || '') || 'Não informado'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Endereço Residencial</span>
              <span className="text-slate-200 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-[#D4AF37]" />
                {funcionario.endereco || 'Não cadastrado'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Contato de Emergência</span>
              <span className="text-slate-200 flex items-center gap-1.5 mt-0.5">
                <HeartHandshake className="w-3.5 h-3.5 text-rose-400" />
                {funcionario.contato_emergencia || 'Não informado'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Dados Contratuais e Jornada */}
        <Card className="bg-[#0F1624] border-[#D4AF37]/20 text-amber-50">
          <CardHeader className="border-b border-[#D4AF37]/10 pb-3">
            <CardTitle className="text-sm font-bold text-amber-100 flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-[#7C3AED]" />
              Dados do Contrato e Lotação
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Cargo Atual</span>
              <span className="font-semibold text-slate-200 text-sm">
                {funcionario.expand?.cargo?.nome || 'Não definido'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Departamento</span>
              <span className="text-slate-200 flex items-center gap-1.5 mt-0.5">
                <Building className="w-3.5 h-3.5 text-[#D4AF37]" />
                {funcionario.expand?.departamento?.nome || 'Geral'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Data de Admissão</span>
              <span className="text-slate-200">{formatBRDate(funcionario.data_admissao)}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">Tipo de Vínculo</span>
              <Badge variant="outline" className="border-[#D4AF37]/30 text-amber-300 mt-1">
                {funcionario.tipo_vinculo || 'CLT'}
              </Badge>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px]">
                Jornada de Trabalho Vinculada
              </span>
              <div className="mt-1 p-2.5 rounded-lg bg-[#070B11] border border-[#D4AF37]/20">
                <div className="font-semibold text-amber-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
                  {funcionario.expand?.jornada_atual?.nome || 'Jornada Padrão'}
                </div>
                {funcionario.expand?.jornada_atual && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Entrada: {funcionario.expand.jornada_atual.hora_entrada} | Saída:{' '}
                    {funcionario.expand.jornada_atual.hora_saida}
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-400 bg-[#7C3AED]/10 p-3 rounded-lg border border-[#7C3AED]/20">
              Caso algum dado cadastral esteja desatualizado ou incorreto, solicite a alteração
              diretamente ao RH na aba <strong>Minhas Solicitações</strong>.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
