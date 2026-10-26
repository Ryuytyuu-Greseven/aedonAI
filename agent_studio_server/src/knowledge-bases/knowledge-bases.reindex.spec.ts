/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { NotFoundException } from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge-bases.service';

describe('KnowledgeBasesService.reindex', () => {
  const knowledgeBasesRepository = {
    filterById: jest.fn(),
    setFileEmbeddingStatus: jest.fn(),
    setUrlEmbeddingStatus: jest.fn(),
  };
  const embeddingsService = { reindexFile: jest.fn(), reindexUrl: jest.fn() };
  const service = new KnowledgeBasesService(
    knowledgeBasesRepository as any,
    {} as any,
    embeddingsService as any,
    {} as any,
  );

  const pdf = { file_id: 'f-pdf', filename: 'brochure.pdf', status: 'active' };
  const legacyImage = { file_id: 'f-img', filename: 'plan.JPG', status: 'active' };
  const url = { url_id: 'u-1', url: 'https://x.test', label: 'Site', status: 'disabled' };
  const knowledgeBase = {
    companyId: 'co-1',
    files: [pdf, legacyImage],
    urls: [url],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    knowledgeBasesRepository.filterById.mockResolvedValue(knowledgeBase);
    knowledgeBasesRepository.setFileEmbeddingStatus.mockResolvedValue(knowledgeBase);
    knowledgeBasesRepository.setUrlEmbeddingStatus.mockResolvedValue(knowledgeBase);
  });

  it('404s for a knowledge base in another company', async () => {
    await expect(service.reindex('kb-1', 'co-2')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(knowledgeBasesRepository.setFileEmbeddingStatus).not.toHaveBeenCalled();
  });

  it('marks sources pending, legacy images not_applicable, and re-indexes the rest', async () => {
    await service.reindex('kb-1', 'co-1');
    await new Promise(process.nextTick);

    expect(knowledgeBasesRepository.setFileEmbeddingStatus).toHaveBeenCalledWith(
      'kb-1',
      'f-pdf',
      'pending',
    );
    expect(knowledgeBasesRepository.setFileEmbeddingStatus).toHaveBeenCalledWith(
      'kb-1',
      'f-img',
      'not_applicable',
    );
    expect(knowledgeBasesRepository.setUrlEmbeddingStatus).toHaveBeenCalledWith(
      'kb-1',
      'u-1',
      'pending',
    );
    expect(embeddingsService.reindexFile).toHaveBeenCalledTimes(1);
    expect(embeddingsService.reindexFile).toHaveBeenCalledWith('kb-1', pdf, 'co-1');
    expect(embeddingsService.reindexUrl).toHaveBeenCalledWith('kb-1', url, 'co-1');
  });
});
