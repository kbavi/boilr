import * as path from 'path';
import * as os from 'os';
import fs from 'fs-extra';
import * as yaml from 'yaml';
import inquirer from 'inquirer';

export interface Config {
  llmProvider: 'gemini' | 'openai' | 'anthropic';
  apiKeys: {
    gemini?: string;
    openai?: string;
    anthropic?: string;
  };
}

export class ConfigService {
  /**
   * Returns the path to the config file: ~/.boilr/config.yaml
   */
  getConfigPath(): string {
    return path.join(os.homedir(), '.boilr', 'config.yaml');
  }

  /**
   * Checks if the config file exists
   */
  async configExists(): Promise<boolean> {
    const configPath = this.getConfigPath();
    return await fs.pathExists(configPath);
  }

  /**
   * Reads and parses the YAML config file
   */
  async readConfig(): Promise<Config> {
    const configPath = this.getConfigPath();
    
    if (!(await this.configExists())) {
      throw new Error(`Config file not found at ${configPath}`);
    }

    const fileContent = await fs.readFile(configPath, 'utf-8');
    const config = yaml.parse(fileContent) as Config;

    // Validate the config structure
    if (!config.llmProvider || !config.apiKeys) {
      throw new Error('Invalid config file structure');
    }

    return config;
  }

  /**
   * Writes the config to ~/.boilr/config.yaml
   * Creates the directory if it doesn't exist
   */
  async writeConfig(config: Config): Promise<void> {
    const configPath = this.getConfigPath();
    const configDir = path.dirname(configPath);

    // Ensure the .boilr directory exists
    await fs.ensureDir(configDir);

    // Convert config to YAML and write
    const yamlContent = yaml.stringify(config);
    await fs.writeFile(configPath, yamlContent, 'utf-8');
  }

  /**
   * Interactive wizard to collect provider and API key from the user
   */
  async runFirstRunWizard(): Promise<Config> {
    // Ask for LLM provider
    const providerAnswer = await inquirer.prompt<{ provider: 'gemini' | 'openai' | 'anthropic' }>([
      {
        type: 'list',
        name: 'provider',
        message: 'Which LLM provider will you be using?',
        choices: [
          { name: 'Gemini (Google)', value: 'gemini' },
          { name: 'OpenAI (GPT)', value: 'openai' },
          { name: 'Anthropic (Claude)', value: 'anthropic' },
        ],
      },
    ]);

    const provider = providerAnswer.provider;

    // Determine the API key prompt message based on provider
    const apiKeyMessages: Record<typeof provider, string> = {
      gemini: 'Please enter your Google AI Studio API Key:',
      openai: 'Please enter your OpenAI API Key:',
      anthropic: 'Please enter your Anthropic API Key:',
    };

    // Ask for API key (password type to hide input)
    const apiKeyAnswer = await inquirer.prompt<{ apiKey: string }>([
      {
        type: 'password',
        name: 'apiKey',
        message: apiKeyMessages[provider],
        mask: '*',
      },
    ]);

    // Build the config object
    const config: Config = {
      llmProvider: provider,
      apiKeys: {
        [provider]: apiKeyAnswer.apiKey,
      },
    };

    // Save the config
    await this.writeConfig(config);

    return config;
  }
}

