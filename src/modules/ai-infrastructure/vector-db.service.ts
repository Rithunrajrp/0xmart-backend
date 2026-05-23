import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pinecone } from '@pinecone-database/pinecone';

export interface VectorRecord {
  id: string;
  values: number[];
  metadata?: Record<string, any>;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface VectorQueryOptions {
  topK?: number;
  filter?: Record<string, any>;
  includeMetadata?: boolean;
}

@Injectable()
export class VectorDBService {
  private readonly logger = new Logger(VectorDBService.name);
  private pinecone: Pinecone;
  private indexName: string;
  private initialized: boolean = false;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('PINECONE_API_KEY');
    this.indexName = this.configService.get<string>('PINECONE_INDEX_NAME', '0xmart-products');

    if (!apiKey) {
      this.logger.warn('PINECONE_API_KEY not configured. Vector search will be disabled.');
      return;
    }

    this.pinecone = new Pinecone({
      apiKey: apiKey,
    });

    this.initialized = true;
  }

  /**
   * Upsert vectors into the index
   */
  async upsert(
    namespace: string,
    records: VectorRecord[],
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector DB not initialized');
    }

    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(namespace).upsert({ records });

      this.logger.log(`Upserted ${records.length} vectors to namespace: ${namespace}`);
    } catch (error) {
      this.logger.error(`Vector upsert error: ${error.message}`, error.stack);
      throw new Error(`Failed to upsert vectors: ${error.message}`);
    }
  }

  /**
   * Query similar vectors
   */
  async query(
    namespace: string,
    queryVector: number[],
    options: VectorQueryOptions = {},
  ): Promise<VectorMatch[]> {
    if (!this.initialized) {
      throw new Error('Vector DB not initialized');
    }

    try {
      const index = this.pinecone.index(this.indexName);

      const queryResponse = await index.namespace(namespace).query({
        vector: queryVector,
        topK: options.topK || 10,
        filter: options.filter,
        includeMetadata: options.includeMetadata ?? true,
      });

      return queryResponse.matches?.map(match => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as Record<string, any>,
      })) || [];
    } catch (error) {
      this.logger.error(`Vector query error: ${error.message}`, error.stack);
      throw new Error(`Failed to query vectors: ${error.message}`);
    }
  }

  /**
   * Delete vectors by IDs
   */
  async delete(
    namespace: string,
    ids: string[],
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector DB not initialized');
    }

    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(namespace).deleteMany(ids);

      this.logger.log(`Deleted ${ids.length} vectors from namespace: ${namespace}`);
    } catch (error) {
      this.logger.error(`Vector delete error: ${error.message}`, error.stack);
      throw new Error(`Failed to delete vectors: ${error.message}`);
    }
  }

  /**
   * Delete all vectors in a namespace
   */
  async deleteAll(namespace: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Vector DB not initialized');
    }

    try {
      const index = this.pinecone.index(this.indexName);

      await index.namespace(namespace).deleteAll();

      this.logger.log(`Deleted all vectors from namespace: ${namespace}`);
    } catch (error) {
      this.logger.error(`Vector delete all error: ${error.message}`, error.stack);
      throw new Error(`Failed to delete all vectors: ${error.message}`);
    }
  }

  /**
   * Fetch vectors by IDs
   */
  async fetch(
    namespace: string,
    ids: string[],
  ): Promise<VectorRecord[]> {
    if (!this.initialized) {
      throw new Error('Vector DB not initialized');
    }

    try {
      const index = this.pinecone.index(this.indexName);

      const fetchResponse = await index.namespace(namespace).fetch({ ids });

      return Object.entries(fetchResponse.records || {}).map(([id, record]) => ({
        id,
        values: record.values || [],
        metadata: record.metadata as Record<string, any>,
      }));
    } catch (error) {
      this.logger.error(`Vector fetch error: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch vectors: ${error.message}`);
    }
  }

  /**
   * Check if vector DB is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
