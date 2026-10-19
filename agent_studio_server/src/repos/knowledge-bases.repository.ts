import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KnowledgeItemEmbeddingStatus } from '../common/interfaces/knowledge-base-embedding.interface';
import {
  KnowledgeBase,
  KnowledgeBaseDocument,
  KnowledgeBaseFile,
  KnowledgeBaseUrl,
  KnowledgeItemStatus,
} from '../schemas/knowledge-base.schema';

@Injectable()
export class KnowledgeBasesRepository {
  constructor(
    @InjectModel(KnowledgeBase.name)
    private readonly knowledgeBaseModel: Model<KnowledgeBaseDocument>,
  ) {}

  async create(data: {
    name: string;
    companyId: string | null;
  }): Promise<KnowledgeBaseDocument> {
    return this.knowledgeBaseModel.create({
      name: data.name,
      companyId: data.companyId,
      status: 'active',
      files: [],
      urls: [],
      organizationId: null,
    });
  }

  async filterAll(companyId: string | null): Promise<KnowledgeBaseDocument[]> {
    return this.knowledgeBaseModel
      .find({ companyId })
      .sort({ created_at: -1 })
      .exec();
  }

  async filterById(id: string): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel.findById(id).exec();
  }

  async countByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (objectIds.length === 0) {
      return 0;
    }
    return this.knowledgeBaseModel
      .countDocuments({ _id: { $in: objectIds } })
      .exec();
  }

  async setStatus(
    id: string,
    status: KnowledgeItemStatus,
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();
  }

  async pushFiles(
    id: string,
    files: KnowledgeBaseFile[],
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findByIdAndUpdate(
        id,
        { $push: { files: { $each: files } } },
        { new: true },
      )
      .exec();
  }

  async pushUrls(
    id: string,
    urls: KnowledgeBaseUrl[],
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findByIdAndUpdate(
        id,
        { $push: { urls: { $each: urls } } },
        { new: true },
      )
      .exec();
  }

  async setFileStatus(
    id: string,
    fileId: string,
    status: KnowledgeItemStatus,
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findOneAndUpdate(
        { _id: id, 'files.file_id': fileId },
        { $set: { 'files.$.status': status } },
        { new: true },
      )
      .exec();
  }

  async setUrlStatus(
    id: string,
    urlId: string,
    status: KnowledgeItemStatus,
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findOneAndUpdate(
        { _id: id, 'urls.url_id': urlId },
        { $set: { 'urls.$.status': status } },
        { new: true },
      )
      .exec();
  }

  async setFileEmbeddingStatus(
    id: string,
    fileId: string,
    embeddingStatus: KnowledgeItemEmbeddingStatus,
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findOneAndUpdate(
        { _id: id, 'files.file_id': fileId },
        { $set: { 'files.$.embedding_status': embeddingStatus } },
        { new: true },
      )
      .exec();
  }

  async setUrlEmbeddingStatus(
    id: string,
    urlId: string,
    embeddingStatus: KnowledgeItemEmbeddingStatus,
  ): Promise<KnowledgeBaseDocument | null> {
    return this.knowledgeBaseModel
      .findOneAndUpdate(
        { _id: id, 'urls.url_id': urlId },
        { $set: { 'urls.$.embedding_status': embeddingStatus } },
        { new: true },
      )
      .exec();
  }
}
