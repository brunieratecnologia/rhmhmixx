import React, { useEffect, useState } from 'react'
import { cargosService } from '@/services/rh'
import type { Cargo } from '@/types/rh'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Briefcase, Plus, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface CargoWithCount extends Cargo {
  employeeCount: number
}

export default function Cargos() {
  const { toast } = useToast()
  const [cargos, setCargos] = useState<CargoWithCount[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCargo, setEditingCargo] = useState<Cargo | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete Confirm Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [cargoToDelete, setCargoToDelete] = useState<CargoWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const cargs = await cargosService.list()

      // Fetch employee counts
      const funcs = await pb.collection('funcionarios').getFullList({
        fields: 'id,cargo',
      })

      const counts: Record<string, number> = {}
      for (const f of funcs as any[]) {
        if (f.cargo) {
          counts[f.cargo] = (counts[f.cargo] || 0) + 1
        }
      }

      const listWithCount: CargoWithCount[] = cargs.map((c) => ({
        ...c,
        employeeCount: counts[c.id] || 0,
      }))

      setCargos(listWithCount)
    } catch (err) {
      console.error('Erro ao carregar cargos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    let unsub: (() => void) | undefined
    pb.collection('cargos')
      .subscribe('*', () => {
        loadData()
      })
      .then((u) => {
        unsub = u
      })
      .catch(() => {})

    return () => {
      if (unsub) unsub()
    }
  }, [])

  const handleOpenCreate = () => {
    setEditingCargo(null)
    setNome('')
    setModalOpen(true)
  }

  const handleOpenEdit = (c: Cargo) => {
    setEditingCargo(c)
    setNome(c.nome)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setSaving(true)
    try {
      if (editingCargo) {
        await cargosService.update(editingCargo.id, nome)
        toast({
          title: 'Cargo atualizado.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else {
        await cargosService.create(nome)
        toast({
          title: 'Cargo criado com sucesso.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      }
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Verifique se já existe um cargo com este nome.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!cargoToDelete) return
    setDeleting(true)
    try {
      await cargosService.delete(cargoToDelete.id)
      toast({
        title: 'Cargo excluído.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setDeleteModalOpen(false)
      setCargoToDelete(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Não é possível excluir',
        description: err?.message || 'Existem funcionários vinculados a este cargo.',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cargos</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie os cargos e funções profissionais dos colaboradores da empresa
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs sm:text-sm h-10 px-4 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Cargo
        </Button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : cargos.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Nenhum cargo cadastrado.</p>
            <Button onClick={handleOpenCreate} variant="outline" className="mt-4 text-xs">
              Cadastrar primeiro cargo
            </Button>
          </div>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-xs">
                <th className="py-3.5 px-6">Título do Cargo</th>
                <th className="py-3.5 px-6">Funcionários Vinculados</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargos.map((cargo) => (
                <tr key={cargo.id} className="hover:bg-[#F0F6FF] transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-slate-400" />
                    {cargo.nome}
                  </td>
                  <td className="py-3.5 px-6 text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {cargo.employeeCount}{' '}
                      {cargo.employeeCount === 1 ? 'colaborador' : 'colaboradores'}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(cargo)}
                        className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-[#2563EB]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCargoToDelete(cargo)
                          setDeleteModalOpen(true)
                        }}
                        className="h-8 w-8 p-0 border-slate-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Criar / Editar Cargo */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCargo ? 'Editar Cargo' : 'Novo Cargo'}</DialogTitle>
            <DialogDescription>
              {editingCargo
                ? 'Atualize o título do cargo no sistema.'
                : 'Defina o nome da nova função profissional.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cargoNome" className="text-xs font-semibold">
                Título do Cargo <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cargoNome"
                required
                placeholder="Ex: Desenvolvedor, Analista Financeiro"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                autoFocus
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
              >
                {saving ? 'Salvando...' : 'Salvar Cargo'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Cargo</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir o cargo <strong>{cargoToDelete?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>

          {cargoToDelete && cargoToDelete.employeeCount > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              Não é possível excluir: existem {cargoToDelete.employeeCount} funcionários vinculados
              a este cargo.
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={deleting || (cargoToDelete ? cargoToDelete.employeeCount > 0 : false)}
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Excluindo...' : 'Confirmar Exclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
