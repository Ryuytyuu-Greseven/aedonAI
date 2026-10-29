import { createVectorSearchIndex, closePropertyStoreConnection } from '../src/agent/graphs/sales/tool/property.store.js';

async function main() {
  console.log('Connecting to MongoDB Atlas to create properties_vector_index...');
  try {
    const indexName = await createVectorSearchIndex();
    console.log(`✅ Atlas Vector Search index '${indexName}' creation initiated.`);
    console.log('MongoDB Atlas will build the index in the background (usually takes 1-2 minutes).');
  } catch (err: any) {
    if (err?.codeName === 'IndexAlreadyExists' || err?.message?.includes('already exists')) {
      console.log('ℹ️ Index properties_vector_index already exists in MongoDB Atlas.');
    } else {
      throw err;
    }
  } finally {
    await closePropertyStoreConnection();
  }
}

main().catch((err) => {
  console.error('❌ Failed to create vector search index:', err);
  process.exitCode = 1;
});

