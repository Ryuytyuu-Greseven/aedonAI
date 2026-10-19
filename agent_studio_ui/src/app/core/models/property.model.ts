export interface Property {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePropertyInput {
  name: string;
  description?: string;
}

export interface UpdatePropertyInput {
  name?: string;
  description?: string;
}
