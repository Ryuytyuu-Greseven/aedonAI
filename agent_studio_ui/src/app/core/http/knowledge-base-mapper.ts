import {
  KnowledgeBase,
  KnowledgeBaseFile,
  KnowledgeBaseItemStatus,
  KnowledgeBaseStatus,
  KnowledgeBaseUrl,
  NewKnowledgeBaseFileInput,
} from '../models/knowledge-base.model';

export interface ApiKbFile {
  file_id: string;
  filename: string;
  filesize: number;
  cloud_file_path?: string;
  status?: KnowledgeBaseItemStatus | string;
}

export interface ApiKbUrl {
  url_id: string;
  label: string;
  url: string;
  status?: KnowledgeBaseItemStatus | string;
}

export interface ApiKnowledgeBase {
  id: string;
  name: string;
  status?: KnowledgeBaseStatus | string;
  files?: ApiKbFile[];
  urls?: ApiKbUrl[];
  organizationId?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
}

/** `POST /:id/files` is `multipart/form-data` — repeat the `files` field per file, actual binary content. */
export function toAddKnowledgeBaseFilesFormData(files: NewKnowledgeBaseFileInput[]): FormData {
  const formData = new FormData();
  files.forEach((f) => formData.append('files', f.file, f.filename));
  return formData;
}

export interface AddKnowledgeBaseUrlsRequest {
  newUrls: Array<{ label: string; url: string }>;
}

function toItemStatus(value: string | undefined): KnowledgeBaseItemStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function toKbStatus(value: string | undefined): KnowledgeBaseStatus {
  return value === 'disabled' ? 'disabled' : 'active';
}

function fromApiFile(raw: ApiKbFile): KnowledgeBaseFile {
  return {
    file_id: raw.file_id,
    filename: raw.filename,
    filesize: raw.filesize,
    cloud_file_path: raw.cloud_file_path ?? '',
    status: toItemStatus(raw.status),
  };
}

function fromApiUrl(raw: ApiKbUrl): KnowledgeBaseUrl {
  return {
    url_id: raw.url_id,
    label: raw.label,
    url: raw.url,
    status: toItemStatus(raw.status),
  };
}

export function fromApiKnowledgeBase(raw: ApiKnowledgeBase): KnowledgeBase {
  return {
    id: raw.id,
    name: raw.name,
    status: toKbStatus(raw.status),
    files: (raw.files ?? []).map(fromApiFile),
    urls: (raw.urls ?? []).map(fromApiUrl),
    organizationId: raw.organizationId ?? null,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}
