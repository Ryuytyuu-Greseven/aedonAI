import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { assertSameCompany } from '../common/utils/company-scope.util';
import { isDuplicateKeyError } from '../common/utils/mongo-error.util';
import { sanitizeName } from '../common/utils/slug.util';
import { AgentsRepository } from '../repos/agents.repository';
import { KnowledgeBasesRepository } from '../repos/knowledge-bases.repository';
import {
  KnowledgeBase,
  KnowledgeBaseFile,
  KnowledgeBaseUrl,
} from '../schemas/knowledge-base.schema';
import { NewKnowledgeBaseUrlDto } from './dto/add-urls.dto';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { KnowledgeBaseEmbeddingsService } from './embeddings/knowledge-base-embeddings.service';
import { KnowledgeBaseStorageService } from './storage/knowledge-base-storage.service';

@Injectable()
export class KnowledgeBasesService {
  constructor(
    private readonly knowledgeBasesRepository: KnowledgeBasesRepository,
    private readonly agentsRepository: AgentsRepository,
    private readonly knowledgeBaseEmbeddingsService: KnowledgeBaseEmbeddingsService,
    private readonly knowledgeBaseStorageService: KnowledgeBaseStorageService,
  ) { }

  async create(
    dto: CreateKnowledgeBaseDto,
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    try {
      return await this.knowledgeBasesRepository.create({
        name: dto.name.trim(),
        companyId,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          'A knowledge base with this name already exists',
        );
      }
      throw error;
    }
  }

  async findAll(companyId: string | null): Promise<KnowledgeBase[]> {
    return this.knowledgeBasesRepository.filterAll(companyId);
  }

  async findById(
    id: string,
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    const knowledgeBase = await this.knowledgeBasesRepository.filterById(id);
    if (!knowledgeBase) {
      throw new NotFoundException(`Knowledge base ${id} not found`);
    }
    assertSameCompany(
      companyId,
      knowledgeBase.companyId,
      `Knowledge base ${id} not found`,
    );
    return knowledgeBase;
  }

  async disable(id: string, companyId: string | null): Promise<KnowledgeBase> {
    await this.findById(id, companyId);
    const activeLinkedCount =
      await this.agentsRepository.countActiveByKnowledgeBaseId(id);
    if (activeLinkedCount > 0) {
      throw new ConflictException(
        'Cannot disable knowledge base while active live agents are linked to it',
      );
    }
    const updated = await this.knowledgeBasesRepository.setStatus(
      id,
      'disabled',
    );
    if (!updated) {
      throw new NotFoundException(`Knowledge base ${id} not found`);
    }
    return updated;
  }

  async enable(id: string, companyId: string | null): Promise<KnowledgeBase> {
    await this.findById(id, companyId);
    const updated = await this.knowledgeBasesRepository.setStatus(id, 'active');
    if (!updated) {
      throw new NotFoundException(`Knowledge base ${id} not found`);
    }
    return updated;
  }

  async addFiles(
    id: string,
    uploadedFiles: Express.Multer.File[],
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    const knowledgeBase = await this.findById(id, companyId);
    const sanitized = sanitizeName(knowledgeBase.name) || 'kb';
    const now = new Date();

    const files: KnowledgeBaseFile[] = await Promise.all(
      uploadedFiles.map(async (uploaded) => {
        const fileId = `${sanitized}_${randomUUID()}`;
        const { objectPath } =
          await this.knowledgeBaseStorageService.uploadFile(
            sanitized,
            fileId,
            uploaded.originalname,
            uploaded.buffer,
            uploaded.mimetype,
          );
        const isImage = uploaded.mimetype.startsWith('image/');
        return {
          companyId,
          file_id: fileId,
          filename: uploaded.originalname,
          uploaded_date: now,
          cloud_file_path: objectPath,
          filesize: uploaded.size,
          status: 'active' as const,
          embedding_status: isImage
            ? ('not_applicable' as const)
            : ('pending' as const),
        };
      }),
    );

    const updated = await this.knowledgeBasesRepository.pushFiles(id, files);
    if (!updated) {
      throw new NotFoundException(`Knowledge base ${id} not found`);
    }

    files.forEach((file, index) => {
      if (file.embedding_status === 'not_applicable') {
        return;
      }
      void this.knowledgeBaseEmbeddingsService.indexFile(
        id,
        file.file_id,
        file.filename,
        uploadedFiles[index].buffer,
        uploadedFiles[index].mimetype,
        companyId,
      );
    });

    return updated;
  }

  async addUrls(
    id: string,
    newUrls: NewKnowledgeBaseUrlDto[],
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    await this.findById(id, companyId);
    const now = new Date();
    const urls: KnowledgeBaseUrl[] = newUrls.map((item) => ({
      companyId,
      url_id: randomUUID(),
      label: item.label.trim(),
      url: item.url.trim(),
      uploaded_date: now,
      status: 'active',
      embedding_status: 'pending',
    }));

    const updated = await this.knowledgeBasesRepository.pushUrls(id, urls);
    if (!updated) {
      throw new NotFoundException(`Knowledge base ${id} not found`);
    }

    urls.forEach((url) => {
      void this.knowledgeBaseEmbeddingsService.indexUrl(
        id,
        url.url_id,
        url.url,
        companyId,
      );
    });

    return updated;
  }

  async disableFile(
    id: string,
    fileId: string,
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    const updated = await this.setFileStatus(id, fileId, 'disabled', companyId);
    await this.knowledgeBaseEmbeddingsService.setSourceActive(
      id,
      'file',
      fileId,
      false,
    );
    return updated;
  }

  async enableFile(
    id: string,
    fileId: string,
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    const updated = await this.setFileStatus(id, fileId, 'active', companyId);
    await this.knowledgeBaseEmbeddingsService.setSourceActive(
      id,
      'file',
      fileId,
      true,
    );
    return updated;
  }

  async disableUrl(
    id: string,
    urlId: string,
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    const updated = await this.setUrlStatus(id, urlId, 'disabled', companyId);
    await this.knowledgeBaseEmbeddingsService.setSourceActive(
      id,
      'url',
      urlId,
      false,
    );
    return updated;
  }

  async enableUrl(
    id: string,
    urlId: string,
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    const updated = await this.setUrlStatus(id, urlId, 'active', companyId);
    await this.knowledgeBaseEmbeddingsService.setSourceActive(
      id,
      'url',
      urlId,
      true,
    );
    return updated;
  }

  private async setFileStatus(
    id: string,
    fileId: string,
    status: 'active' | 'disabled',
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    await this.findById(id, companyId);
    const updated = await this.knowledgeBasesRepository.setFileStatus(
      id,
      fileId,
      status,
    );
    if (!updated) {
      throw new NotFoundException(
        `File ${fileId} not found in knowledge base ${id}`,
      );
    }
    return updated;
  }

  private async setUrlStatus(
    id: string,
    urlId: string,
    status: 'active' | 'disabled',
    companyId: string | null,
  ): Promise<KnowledgeBase> {
    await this.findById(id, companyId);
    const updated = await this.knowledgeBasesRepository.setUrlStatus(
      id,
      urlId,
      status,
    );
    if (!updated) {
      throw new NotFoundException(
        `URL ${urlId} not found in knowledge base ${id}`,
      );
    }
    return updated;
  }
}
