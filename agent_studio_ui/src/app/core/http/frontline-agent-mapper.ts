import { UserRole } from '../models/auth.model';
import { SalesAgentAccount } from '../models/sales-agent-account.model';

/** Wire shape for `/api/frontline-agents/*` responses (see logins.md). */
export interface ApiFrontlineAgent {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isDisabled: boolean;
  companyId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function fromApiFrontlineAgent(raw: ApiFrontlineAgent): SalesAgentAccount {
  return {
    id: raw.id,
    name: raw.name,
    email: raw.email,
    enabled: !raw.isDisabled,
    createdAt: raw.createdAt,
  };
}
