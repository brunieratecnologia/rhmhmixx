import { portalService, empresaService, documentosService, holeritesService } from '@/services/rh'
import type {
  Funcionario,
  RegistroHorario,
  Ferias,
  Holerite,
  Documento,
  Solicitacao,
} from '@/types/rh'

export interface PortalContextType {
  funcionario: Funcionario | null
  reloadFuncionario: () => Promise<void>
}
