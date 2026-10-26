import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadedKnowledgeBaseFile } from '../../common/interfaces/knowledge-base-storage.interface';

// Folder for knowledge bases that aren't owned by any company (companyId null).
const UNASSIGNED_CLIENT_FOLDER = 'unassigned';

/**
 * Persists knowledge base files to GCS under
 * `{clientId}/{knowledgeBaseFolder}/{fileId}/{filename}` in a single shared
 * bucket, so every customer's knowledge bases live in their own folder.
 * `clientId` is the owning company's `companyId` (`{companyname}_{uuid}`).
 */
@Injectable()
export class KnowledgeBaseStorageService {
  private readonly storage = new Storage();
  private readonly bucketName: string;

  constructor(config: ConfigService) {
    this.bucketName = config.getOrThrow<string>('GCS_BUCKET_NAME');
  }

  async uploadFile(
    companyId: string | null,
    knowledgeBaseFolder: string,
    fileId: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadedKnowledgeBaseFile> {
    const clientId = companyId || UNASSIGNED_CLIENT_FOLDER;
    const objectPath = `${clientId}/${knowledgeBaseFolder}/${fileId}/${filename}`;
    await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .save(buffer, { contentType, resumable: false });

    return { objectPath, gcsUri: `gs://${this.bucketName}/${objectPath}` };
  }

  /** Reads back a previously uploaded file (e.g. to re-index it). */
  async downloadFile(objectPath: string): Promise<Buffer> {
    const [contents] = await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .download();
    return contents;
  }
}
