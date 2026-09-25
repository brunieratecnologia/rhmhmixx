import React, { useEffect, useState } from 'react'
import { departamentosService } from '@/services/rh'
import type { Departamento } from '@/types/rh'
import pb from '@/lib/pocketbase/client'
import { useToast } from '@/hooks/use-toast'
import { Building2, Plus, Pencil, Trash2, Users } from 'lucide-react'
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

interface DepWithCount extends Departamento {
  employeeCount: number
}

export default function Departamentos() {
  const { toast } = useToast()
  const [departamentos, setDepartamentos] = useState<DepWithCount[]>([])
  const [loading, setLoading] = useState(true)

  // Modal State
  const [modalOpen, setModalOpen] = useState(false)
  const [editingDep, setEditingDep] = useState<Departamento | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete Confirm Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [depToDelete, setDepToDelete] = useState<DepWithCount | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = async () => {
    try {
      const deps = await departamentosService.list()

      // Fetch employee counts
      const funcs = await pb.collection('funcionarios').getFullList({
        fields: 'id,departamento',
      })

      const counts: Record<string, number> = {}
      for (const f of funcs as any[]) {
        if (f.departamento) {
          counts[f.departamento] = (counts[f.departamento] || 0) + 1
        }
      }

      const listWithCount: DepWithCount[] = deps.map((d) => ({
        ...d,
        employeeCount: counts[d.id] || 0,
      }))

      setDepartamentos(listWithCount)
    } catch (err) {
      console.error('Erro ao carregar departamentos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()

    let unsub: (() => void) | undefined
    pb.collection('departamentos')
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
    setEditingDep(null)
    setNome('')
    setModalOpen(true)
  }

  const handleOpenEdit = (dep: Departamento) => {
    setEditingDep(dep)
    setNome(dep.nome)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) return

    setSaving(true)
    try {
      if (editingDep) {
        await departamentosService.update(editingDep.id, nome)
        toast({
          title: 'Departamento atualizado.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      } else {
        await departamentosService.create(nome)
        toast({
          title: 'Departamento criado com sucesso.',
          className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        })
      }
      setModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Erro ao salvar',
        description: err?.message || 'Verifique se já existe um departamento com este nome.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!depToDelete) return
    setDeleting(true)
    try {
      await departamentosService.delete(depToDelete.id)
      toast({
        title: 'Departamento excluído.',
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      })
      setDeleteModalOpen(false)
      setDepToDelete(null)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Não é possível excluir',
        description: err?.message || 'Existem funcionários vinculados a este departamento.',
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
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Departamentos</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie os setores organizacionais e a alocação de equipes da empresa
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold text-xs sm:text-sm h-10 px-4 shadow-sm border-0 hover:brightness-110"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Departamento
        </Button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : departamentos.length === 0 ? (
          <div className="py-16 text-center">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Nenhum departamento cadastrado.</p>
            <Button onClick={handleOpenCreate} variant="outline" className="mt-4 text-xs">
              Cadastrar primeiro departamento
            </Button>
          </div>
        ) : (
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold text-xs">
                <th className="py-3.5 px-6">Nome do Departamento</th>
                <th className="py-3.5 px-6">Funcionários Vinculados</th>
                <th className="py-3.5 px-6 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {departamentos.map((dep) => (
                <tr key={dep.id} className="hover:bg-[#F0F6FF] transition-colors">
                  <td className="py-3.5 px-6 font-semibold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400" />
                    {dep.nome}
                  </td>
                  <td className="py-3.5 px-6 text-slate-600">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      {dep.employeeCount}{' '}
                      {dep.employeeCount === 1 ? 'colaborador' : 'colaboradores'}
                    </span>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(dep)}
                        className="h-8 w-8 p-0 border-slate-200 text-slate-600 hover:text-[#D4AF37]"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDepToDelete(dep)
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

      {/* Modal Criar / Editar Departamento */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDep ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
            <DialogDescription>
              {editingDep
                ? 'Atualize o nome do departamento no sistema.'
                : 'Defina o nome do novo setor organizacional.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="depNome" className="text-xs font-semibold">
                Nome do Departamento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="depNome"
                required
                placeholder="Ex: Comercial, Tecnologia, Logística"
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
                className="bg-gradient-to-r from-[#D4AF37] via-[#E5C07B] to-[#AA820A] text-slate-950 font-bold border-0 hover:brightness-110"
              >
                {saving ? 'Salvando...' : 'Salvar Departamento'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Departamento</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir o departamento <strong>{depToDelete?.nome}</strong>?
            </DialogDescription>
          </DialogHeader>

          {depToDelete && depToDelete.employeeCount > 0 && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
              Não é possível excluir: existem {depToDelete.employeeCount} funcionários vinculados a
              este departamento.
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
              disabled={deleting || (depToDelete ? depToDelete.employeeCount > 0 : false)}
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
