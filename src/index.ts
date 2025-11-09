#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigService, Config } from './configService.js';
import { AiService } from './aiService.js';
import { type AbstractSchema } from './schemaTypes.js';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';

const program = new Command();
const configService = new ConfigService();

program
  .name('boilr')
  .description('AI-powered CLI tool that generates production-ready, domain-aware SaaS boilerplate')
  .version('0.1.0');

program
  .command('config')
  .description('Update your AI provider configuration')
  .action(async () => {
    try {
      console.log(chalk.blue('Let\'s update your AI provider configuration.'));
      await configService.runFirstRunWizard();
      console.log(chalk.green('✓ Configuration saved!'));
    } catch (error) {
      console.error(chalk.red('Error updating configuration:'), error);
      process.exit(1);
    }
  });

/**
 * Pretty-prints an abstract schema to the console.
 */
function printSchema(schema: AbstractSchema): void {
  console.log(chalk.cyan('\nHere\'s the schema I\'m proposing:\n'));
  
  for (const model of schema.models) {
    console.log(chalk.yellow(`Model: ${model.name}`));
    for (const field of model.fields) {
      const constraints: string[] = [];
      
      if (field.primaryKey) constraints.push('primary_key');
      if (field.notNull) constraints.push('not_null');
      if (field.unique) constraints.push('unique');
      if (field.default) constraints.push(`default: '${field.default}'`);
      if (field.references) constraints.push(`references: ${field.references.model}.${field.references.field}`);
      
      const constraintsStr = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
      console.log(chalk.gray(`  - ${field.name}: ${field.type}${constraintsStr}`));
    }
    console.log();
  }
}

/**
 * Main app flow: generates and revises schema interactively.
 */
async function runMainFlow(config: Config): Promise<void> {
  // Ask for project name
  const projectAnswer = await inquirer.prompt<{ projectName: string }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'What\'s the name of your project? (e.g., my-clinic-app)',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'Project name cannot be empty';
        }
        // Basic validation for project name (no spaces, valid characters)
        if (!/^[a-z0-9-_]+$/i.test(input.trim())) {
          return 'Project name can only contain letters, numbers, hyphens, and underscores';
        }
        return true;
      },
    },
  ]);

  const projectName = projectAnswer.projectName.trim();

  // Ask for app idea
  const ideaAnswer = await inquirer.prompt<{ idea: string }>([
    {
      type: 'input',
      name: 'idea',
      message: 'Great! Now, describe the app you want to build. (e.g., "A to-do app for teams")',
      validate: (input: string) => {
        if (!input.trim()) {
          return 'App description cannot be empty';
        }
        return true;
      },
    },
  ]);

  const idea = ideaAnswer.idea.trim();

  // Initialize AI service
  const ai = new AiService(config);
  const providerNames: Record<Config['llmProvider'], string> = {
    gemini: 'Gemini',
    openai: 'OpenAI',
    anthropic: 'Claude',
  };

  // Generate initial schema
  const spinner = ora(`Analyzing your idea and proposing a database schema (using ${providerNames[config.llmProvider]})...`).start();
  
  let schema: AbstractSchema;
  try {
    schema = await ai.generateSchema(idea);
    spinner.succeed('Schema generated successfully!');
  } catch (error) {
    spinner.fail('Failed to generate schema');
    throw error;
  }

  // Interactive revision loop
  let approved = false;
  while (!approved) {
    printSchema(schema);

    const approvalAnswer = await inquirer.prompt<{ response: string }>([
      {
        type: 'input',
        name: 'response',
        message: 'Does this look right? You can approve it or suggest changes.\n(e.g., "Looks good", "Add \'dateOfBirth:date\' to patients"):',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Please provide feedback or approve the schema';
          }
          return true;
        },
      },
    ]);

    const response = approvalAnswer.response.trim().toLowerCase();

    // Check if user approves
    if (response === 'looks good' || response === 'yes' || response === 'y' || response === 'approve' || response === 'ok') {
      approved = true;
      console.log(chalk.green('\n✓ Schema approved!'));
    } else {
      // Revise the schema
      const reviseSpinner = ora(`Revising schema (using ${providerNames[config.llmProvider]})...`).start();
      try {
        schema = await ai.reviseSchema(schema, approvalAnswer.response);
        reviseSpinner.succeed('Schema revised successfully!');
      } catch (error) {
        reviseSpinner.fail('Failed to revise schema');
        throw error;
      }
    }
  }

  // TODO: Continue with scaffolding (Milestone 3)
  console.log(chalk.blue(`\nProject name: ${projectName}`));
  console.log(chalk.blue('Schema generation complete! Scaffolding will be implemented in Milestone 3.'));
}

program
  .action(async () => {
    try {
      // Main boilr command logic
      let config: Config;
      
      if (await configService.configExists()) {
        config = await configService.readConfig();
        const providerNames: Record<Config['llmProvider'], string> = {
          gemini: 'Gemini',
          openai: 'OpenAI',
          anthropic: 'Claude',
        };
        console.log(chalk.blue(`Welcome back to Boilr! 🪄 (Using ${providerNames[config.llmProvider]} from ~/.boiler/config.yaml)`));
      } else {
        console.log(chalk.blue('Welcome to Boilr! 🪄'));
        console.log(chalk.blue('I see this is your first time. Let\'s set up your AI provider.'));
        config = await configService.runFirstRunWizard();
        console.log(chalk.green('✓ Configuration saved!'));
        console.log(chalk.blue('Now, let\'s build your new SaaS project.'));
      }
      
      // Run the main flow with schema generation and revision
      await runMainFlow(config);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

