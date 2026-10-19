import { CreatePropertyInput, Property, UpdatePropertyInput } from '../models/property.model';

/** Wire shape of a property — `sales.md`. */
export interface ApiProperty {
  id: string;
  companyId: string;
  agentId: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePropertyRequest {
  agentId: string;
  name: string;
  description?: string;
}

export type UpdatePropertyRequest = UpdatePropertyInput;

export function fromApiProperty(raw: ApiProperty): Property {
  return {
    id: raw.id,
    agent_id: raw.agentId,
    name: raw.name,
    description: raw.description ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export function toCreatePropertyRequest(agentId: string, input: CreatePropertyInput): CreatePropertyRequest {
  const body: CreatePropertyRequest = { agentId, name: input.name };
  if (input.description !== undefined) body.description = input.description;
  return body;
}

export function toUpdatePropertyRequest(input: UpdatePropertyInput): UpdatePropertyRequest {
  const body: UpdatePropertyRequest = {};
  if (input.name !== undefined) body.name = input.name;
  if (input.description !== undefined) body.description = input.description;
  return body;
}
