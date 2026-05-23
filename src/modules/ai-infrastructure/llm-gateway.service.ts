import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  tools?: ChatCompletionTool[];
  toolChoice?: 'auto' | 'none' | 'required';
}

export interface StreamedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type LLMStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; toolCalls: StreamedToolCall[] }
  | { type: 'done'; finishReason: string };

@Injectable()
export class LLMGatewayService {
  private readonly logger = new Logger(LLMGatewayService.name);
  private openai: OpenAI;
  private defaultModel: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not configured. LLM features will be disabled.');
    }

    this.openai = new OpenAI({
      apiKey: apiKey || 'dummy',
    });

    this.defaultModel = this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
  }

  /**
   * Generate a chat completion (non-streaming)
   */
  async chat(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        tools: options.tools,
        tool_choice: options.toolChoice,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      this.logger.error(`LLM chat error: ${error.message}`, error.stack);
      throw new Error(`Failed to generate LLM response: ${error.message}`);
    }
  }

  /**
   * Generate a streaming chat completion
   */
  async *chatStream(
    messages: LLMMessage[],
    options: LLMCompletionOptions = {},
  ): AsyncIterableIterator<string> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        stream: true,
        tools: options.tools,
        tool_choice: options.toolChoice,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }

        // Handle tool calls
        const toolCalls = chunk.choices[0]?.delta?.tool_calls;
        if (toolCalls) {
          // Yield tool calls as JSON string
          yield JSON.stringify({ tool_calls: toolCalls });
        }
      }
    } catch (error) {
      this.logger.error(`LLM stream error: ${error.message}`, error.stack);
      throw new Error(`Failed to generate streaming LLM response: ${error.message}`);
    }
  }

  /**
   * Generate a chat completion with function calling
   */
  async chatWithTools(
    messages: LLMMessage[],
    tools: ChatCompletionTool[],
    options: LLMCompletionOptions = {},
  ): Promise<{
    content: string;
    toolCalls: any[];
  }> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        tools: tools,
        tool_choice: options.toolChoice || 'auto',
      });

      const message = completion.choices[0]?.message;

      return {
        content: message?.content || '',
        toolCalls: message?.tool_calls || [],
      };
    } catch (error) {
      this.logger.error(`LLM chat with tools error: ${error.message}`, error.stack);
      throw new Error(`Failed to generate LLM response with tools: ${error.message}`);
    }
  }

  /**
   * Streaming chat completion with proper tool-call delta accumulation.
   * Yields text chunks immediately; accumulates tool_call deltas across
   * multiple SSE events and yields them as a single tool_calls event once
   * finish_reason arrives.
   */
  async *chatStreamWithTools(
    messages: LLMMessage[],
    tools: ChatCompletionTool[],
    options: LLMCompletionOptions = {},
  ): AsyncIterableIterator<LLMStreamEvent> {
    try {
      const stream = await this.openai.chat.completions.create({
        model: options.model || this.defaultModel,
        messages: messages as ChatCompletionMessageParam[],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2000,
        stream: true,
        tools,
        tool_choice: options.toolChoice || 'auto',
      });

      const accumulatedToolCalls: StreamedToolCall[] = [];
      let doneYielded = false;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;

        // Stream text deltas immediately
        if (choice.delta?.content) {
          yield { type: 'text', content: choice.delta.content };
        }

        // Accumulate tool-call deltas by index
        if (choice.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index;
            if (!accumulatedToolCalls[idx]) {
              accumulatedToolCalls[idx] = { id: '', name: '', arguments: '' };
            }
            if (tc.id) accumulatedToolCalls[idx].id = tc.id;
            if (tc.function?.name) accumulatedToolCalls[idx].name += tc.function.name;
            if (tc.function?.arguments) accumulatedToolCalls[idx].arguments += tc.function.arguments;
          }
        }

        // On finish, yield accumulated tool calls then done
        if (choice.finish_reason) {
          if (choice.finish_reason === 'tool_calls' && accumulatedToolCalls.length > 0) {
            yield { type: 'tool_calls', toolCalls: accumulatedToolCalls };
          }
          yield { type: 'done', finishReason: choice.finish_reason };
          doneYielded = true;
        }
      }

      // Safety: if stream ended without finish_reason
      if (!doneYielded) {
        if (accumulatedToolCalls.length > 0) {
          yield { type: 'tool_calls', toolCalls: accumulatedToolCalls };
        }
        yield { type: 'done', finishReason: 'stop' };
      }
    } catch (error) {
      this.logger.error(`LLM stream-with-tools error: ${error.message}`, error.stack);
      throw new Error(`Failed to generate streaming LLM response with tools: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error(`Embedding generation error: ${error.message}`, error.stack);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });

      return response.data.map(item => item.embedding);
    } catch (error) {
      this.logger.error(`Batch embedding generation error: ${error.message}`, error.stack);
      throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
  }
}
