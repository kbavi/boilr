import { z } from 'zod';

/**
 * Field type definitions for the abstract schema.
 * These are database-agnostic types that will be translated to Drizzle/Postgres later.
 */
export const FieldTypeSchema = z.enum([
  'serial',
  'integer',
  'bigint',
  'text',
  'varchar',
  'boolean',
  'date',
  'timestamp',
  'decimal',
  'float',
  'json',
  'jsonb',
  'uuid',
]);

export type FieldType = z.infer<typeof FieldTypeSchema>;

/**
 * Reference definition for foreign key relationships.
 */
export const ReferenceSchema = z.object({
  model: z.string().describe('The name of the referenced model'),
  field: z.string().describe('The name of the referenced field (usually "id")'),
});

export type Reference = z.infer<typeof ReferenceSchema>;

/**
 * Field definition in the abstract schema.
 */
export const FieldSchema = z.object({
  name: z.string().describe('The name of the field'),
  type: FieldTypeSchema.describe('The data type of the field'),
  primaryKey: z.boolean().optional().default(false).describe('Whether this field is a primary key'),
  notNull: z.boolean().optional().default(false).describe('Whether this field cannot be null'),
  unique: z.boolean().optional().default(false).describe('Whether this field must be unique'),
  default: z.string().optional().describe('Default value as a string (will be parsed based on type)'),
  references: ReferenceSchema.optional().describe('Foreign key reference to another model'),
});

export type Field = z.infer<typeof FieldSchema>;

/**
 * Model definition in the abstract schema.
 */
export const ModelSchema = z.object({
  name: z.string().describe('The name of the model (table)'),
  fields: z.array(FieldSchema).min(1).describe('Array of fields in this model'),
});

export type Model = z.infer<typeof ModelSchema>;

/**
 * Abstract schema definition - the main schema structure.
 * This is database-agnostic and will be translated to Drizzle/Postgres syntax later.
 */
export const AbstractSchemaSchema = z.object({
  models: z.array(ModelSchema).min(1).describe('Array of models (tables) in the schema'),
});

export type AbstractSchema = z.infer<typeof AbstractSchemaSchema>;

