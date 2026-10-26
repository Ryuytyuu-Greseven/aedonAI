/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { KnowledgeBaseEmbeddingsService } from './knowledge-base-embeddings.service';

describe('KnowledgeBaseEmbeddingsService', () => {
  const embeddingProvider = {
    name: 'vertex-ai',
    model: 'gemini-embedding-001',
    embed: jest.fn(),
  };
  const textExtraction = { extractFromFile: jest.fn(), extractFromUrl: jest.fn() };
  const salesFormatter = { format: jest.fn() };
  const embeddingsRepository = {
    deleteBySource: jest.fn(),
    insertMany: jest.fn(),
    setStatusBySource: jest.fn(),
  };
  const knowledgeBasesRepository = {
    setFileEmbeddingStatus: jest.fn(),
    setUrlEmbeddingStatus: jest.fn(),
  };
  const storage = { downloadFile: jest.fn() };
  const service = new KnowledgeBaseEmbeddingsService(
    embeddingProvider as any,
    textExtraction as any,
    salesFormatter as any,
    embeddingsRepository as any,
    knowledgeBasesRepository as any,
    storage as any,
  );

  const file = {
    companyId: 'co-1',
    file_id: 'f-1',
    filename: 'skyview.pdf',
    uploaded_date: new Date(),
    cloud_file_path: 'temp_buck/kb/f-1/skyview.pdf',
    filesize: 10,
    status: 'disabled' as const,
    embedding_status: 'completed' as const,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    storage.downloadFile.mockResolvedValue(Buffer.from('pdf'));
    textExtraction.extractFromFile.mockResolvedValue('raw text');
    salesFormatter.format.mockResolvedValue({
      subjectName: 'The Sky View Grand',
      sections: [
        { key: 'amenities', heading: 'Amenities', text: 'Pool and gym.' },
      ],
    });
    embeddingProvider.embed.mockImplementation((texts: string[]) =>
      Promise.resolve(texts.map(() => [0.1, 0.2])),
    );
  });

  it('re-indexes a disabled file keeping it disabled, with section metadata', async () => {
    await service.reindexFile('kb-1', file, 'co-1');

    expect(storage.downloadFile).toHaveBeenCalledWith(file.cloud_file_path);
    expect(embeddingsRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        companyId: 'co-1',
        knowledge_base_id: 'kb-1',
        source_type: 'file',
        source_id: 'f-1',
        source_label: 'skyview.pdf',
        section: 'amenities',
        text: 'Subject: The Sky View Grand | Source: skyview.pdf | Section: Amenities\nPool and gym.',
        model: 'gemini-embedding-001',
        status: 'disabled',
      }),
    ]);
    expect(knowledgeBasesRepository.setFileEmbeddingStatus).toHaveBeenCalledWith(
      'kb-1',
      'f-1',
      'completed',
    );
  });

  it('keeps the previous vectors when embedding fails', async () => {
    embeddingProvider.embed.mockRejectedValue(new Error('quota'));

    await service.reindexFile('kb-1', file, 'co-1');

    expect(embeddingsRepository.deleteBySource).not.toHaveBeenCalled();
    expect(embeddingsRepository.insertMany).not.toHaveBeenCalled();
    expect(knowledgeBasesRepository.setFileEmbeddingStatus).toHaveBeenCalledWith(
      'kb-1',
      'f-1',
      'failed',
    );
  });

  it('marks the file failed when its original cannot be downloaded', async () => {
    storage.downloadFile.mockRejectedValue(new Error('404'));

    await service.reindexFile('kb-1', file, 'co-1');

    expect(textExtraction.extractFromFile).not.toHaveBeenCalled();
    expect(knowledgeBasesRepository.setFileEmbeddingStatus).toHaveBeenCalledWith(
      'kb-1',
      'f-1',
      'failed',
    );
  });

  it('indexes raw text with a source-only header when formatting falls back', async () => {
    salesFormatter.format.mockResolvedValue(null);
    textExtraction.extractFromUrl.mockResolvedValue('Plain page text.');

    await service.indexUrl('kb-1', 'u-1', 'https://x.test', 'Project page', null);

    expect(embeddingsRepository.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({
        companyId: null,
        source_label: 'Project page',
        section: 'raw',
        text: 'Source: Project page\nPlain page text.',
        status: 'active',
      }),
    ]);
  });
});
