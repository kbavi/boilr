#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigService, Config } from './configService.js';
import chalk from 'chalk';

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
        // TODO: Pass config to main app flow (to be implemented in milestone 2)
      } else {
        console.log(chalk.blue('Welcome to Boilr! 🪄'));
        console.log(chalk.blue('I see this is your first time. Let\'s set up your AI provider.'));
        config = await configService.runFirstRunWizard();
        console.log(chalk.green('✓ Configuration saved!'));
        console.log(chalk.blue('Now, let\'s build your new SaaS project.'));
        // TODO: Continue with main app flow (to be implemented in milestone 2)
      }
      
      // Config is now available for the main app flow
      // This will be used in milestone 2
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

program.parse();

