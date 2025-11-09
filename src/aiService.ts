import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject } from 'ai';
import type { LanguageModel } from 'ai';
import type { Config } from './configService.js';
import { AbstractSchemaSchema, type AbstractSchema } from './schemaTypes.js';

/**
 * AI Service class that handles interactions with different LLM providers
 * using the Vercel AI SDK.
 */
export class AiService {
  private config: Config;
  private model: LanguageModel;

  constructor(config: Config) {
    this.config = config;
    this.model = this.initializeModel();
  }

  /**
   * Initializes the correct AI SDK client based on the configured provider.
   * Returns a LanguageModel instance that can be used with generateText/generateObject.
   */
  private initializeModel(): LanguageModel {
    const { llmProvider, apiKeys } = this.config;

    switch (llmProvider) {
      case 'gemini': {
        const apiKey = apiKeys.gemini;
        if (!apiKey) {
          throw new Error('Gemini API key not found in config. Please run "boilr config" to set it up.');
        }
        const google = createGoogleGenerativeAI({ apiKey });
        // Use gemini-1.5-pro as the default model
        return google('models/gemini-1.5-pro');
      }

      case 'openai': {
        const apiKey = apiKeys.openai;
        if (!apiKey) {
          throw new Error('OpenAI API key not found in config. Please run "boilr config" to set it up.');
        }
        const openai = createOpenAI({ apiKey });
        // Use gpt-5 as the default model
        return openai('gpt-5-codex');
      }

      case 'anthropic': {
        const apiKey = apiKeys.anthropic;
        if (!apiKey) {
          throw new Error('Anthropic API key not found in config. Please run "boilr config" to set it up.');
        }
        const anthropic = createAnthropic({ apiKey });
        // Use claude-3-5-sonnet as the default model
        return anthropic('claude-3-5-sonnet-20241022');
      }

      default:
        throw new Error(`Unsupported LLM provider: ${llmProvider}`);
    }
  }

  /**
   * Gets the initialized model instance.
   * This will be used by generateSchema and reviseSchema methods.
   */
  getModel(): LanguageModel {
    return this.model;
  }

  /**
   * Core method that generates or revises a schema using the AI model.
   * Uses toggleable system prompts for different use cases.
   * 
   * @param systemPrompt - The system prompt that defines the AI's role and task
   * @param userPrompt - The user prompt with the specific request
   * @param errorContext - Context for error messages (e.g., "generate schema" or "revise schema")
   * @returns Promise resolving to an AbstractSchema object
   */
  private async generateSchemaWithPrompt(
    systemPrompt: string,
    userPrompt: string,
    errorContext: string
  ): Promise<AbstractSchema> {
    try {
      const result = await generateObject({
        model: this.model,
        system: systemPrompt,
        prompt: userPrompt,
        schema: AbstractSchemaSchema,
      });

      return result.object;
    } catch (error) {
      // Provide helpful error messages for common issues
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          throw new Error(
            `AI call failed. Your API key for ${this.config.llmProvider} seems to be invalid. Please run 'boilr config' to update it.`
          );
        }
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw new Error(
            `AI call failed due to rate limiting. Please try again in a moment.`
          );
        }
      }
      throw new Error(`Failed to ${errorContext}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets the system prompt for generating a new schema.
   */
  private getGenerateSystemPrompt(): string {
    return `You are a senior database architect with expertise in designing scalable, normalized database schemas.

Your task is to analyze a user's app idea and propose a clean, well-structured database schema.

Guidelines:
- Create models (tables) that represent the core entities in the application
- Use appropriate field types (serial, integer, text, timestamp, date, boolean, etc.)
- Include primary keys (id fields) for each model
- Add foreign key relationships where entities reference each other
- Use meaningful field names (snake_case)
- Consider what fields should be required (notNull: true) vs optional
- Add unique constraints where appropriate (e.g., email addresses)
- Think about default values where they make sense
- Keep the schema normalized and avoid redundancy

The schema should be database-agnostic and abstract. Focus on the logical structure, not specific SQL syntax.

Return a schema that includes all necessary models and their relationships to support the described application.`;
  }

  /**
   * Gets the system prompt for revising an existing schema.
   */
  private getReviseSystemPrompt(): string {
    return `You are a senior database architect with expertise in designing scalable, normalized database schemas.

Your task is to revise an existing database schema based on user feedback while maintaining schema integrity and best practices.

Guidelines:
- Preserve all existing models and fields unless explicitly asked to remove them
- Add new fields or models as requested by the user
- Modify existing fields only if requested
- Maintain proper relationships and foreign keys
- Ensure the schema remains normalized and well-structured
- Use appropriate field types (serial, integer, text, timestamp, date, boolean, etc.)
- Keep primary keys (id fields) for each model
- Maintain foreign key relationships where entities reference each other
- Use meaningful field names (snake_case)
- Consider what fields should be required (notNull: true) vs optional
- Add unique constraints where appropriate
- Think about default values where they make sense

The schema should be database-agnostic and abstract. Focus on the logical structure, not specific SQL syntax.

Return the complete revised schema with all changes incorporated.`;
  }

  /**
   * Generates an abstract database schema from a natural language app idea.
   * Uses the Vercel AI SDK with Zod schema validation to ensure valid output.
   * 
   * @param idea - Natural language description of the app (e.g., "A clinic management app for clinicians to manage appointments and patients")
   * @returns Promise resolving to an AbstractSchema object
   */
  async generateSchema(idea: string): Promise<AbstractSchema> {
    const systemPrompt = this.getGenerateSystemPrompt();
    const userPrompt = `Based on this app idea, generate a complete database schema:

"${idea}"

Provide a schema with all necessary models, fields, and relationships.`;

    return this.generateSchemaWithPrompt(systemPrompt, userPrompt, 'generate schema');
  }

  /**
   * Revises an existing abstract database schema based on user feedback.
   * Uses the Vercel AI SDK with Zod schema validation to ensure valid output.
   * 
   * @param schema - The current AbstractSchema to revise
   * @param request - Natural language description of the changes requested (e.g., "Add 'dateOfBirth:date' to patients")
   * @returns Promise resolving to a revised AbstractSchema object
   */
  async reviseSchema(schema: AbstractSchema, request: string): Promise<AbstractSchema> {
    const systemPrompt = this.getReviseSystemPrompt();
    const schemaJson = JSON.stringify(schema, null, 2);
    const userPrompt = `Here is the current database schema:

\`\`\`json
${schemaJson}
\`\`\`

The user has requested the following changes:

"${request}"

Please revise the schema to incorporate these changes. Return the complete revised schema with all modifications applied.`;

    return this.generateSchemaWithPrompt(systemPrompt, userPrompt, 'revise schema');
  }
}

