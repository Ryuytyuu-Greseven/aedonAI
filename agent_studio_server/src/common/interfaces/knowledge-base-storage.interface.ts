/** Result of persisting a knowledge base file to blob storage. */
export interface UploadedKnowledgeBaseFile {
  /** Object path within the bucket: `{clientId}/{knowledgeBaseFolder}/{fileId}/{filename}`. */
  objectPath: string;
  /** gs:// URI for the stored object. */
  gcsUri: string;
}
