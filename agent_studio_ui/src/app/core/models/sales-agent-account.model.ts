export interface SalesAgentAccount {
  id: string;
  name: string;
  email: string;
  enabled: boolean;
  createdAt: string;
}

export interface CreateSalesAgentAccountInput {
  name: string;
  email: string;
  password: string;
}
