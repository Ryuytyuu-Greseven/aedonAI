import { Storage } from '@google-cloud/storage';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UploadedKnowledgeBaseFile } from '../../common/interfaces/knowledge-base-storage.interface';

// TODO: replace with the real organization/client id once it's derived from
// the JWT, instead of a fixed value shared by every knowledge base.
const TEMP_CLIENT_ID = 'temp_buck';

/**
 * Persists knowledge base files to GCS under
 * `{clientId}/{knowledgeBaseFolder}/{fileId}/{filename}` in a single shared
 * bucket, so every customer's knowledge bases live in their own folder.
 */
@Injectable()
export class KnowledgeBaseStorageService {
  private readonly storage = new Storage();
  private readonly bucketName: string;
  private readonly clientId = TEMP_CLIENT_ID;

  constructor(config: ConfigService) {
    this.bucketName = config.getOrThrow<string>('GCS_BUCKET_NAME');
  }

  async uploadFile(
    knowledgeBaseFolder: string,
    fileId: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadedKnowledgeBaseFile> {
    const objectPath = `${this.clientId}/${knowledgeBaseFolder}/${fileId}/${filename}`;
    await this.storage
      .bucket(this.bucketName)
      .file(objectPath)
      .save(buffer, { contentType, resumable: false });

    return { objectPath, gcsUri: `gs://${this.bucketName}/${objectPath}` };
  }
}
