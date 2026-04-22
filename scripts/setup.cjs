#!/usr/bin/env node

/**
 * VAST Shopify Theme Setup Wizard
 * Interactive setup script to configure the development environment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Bootstrap: Check and install required packages
async function bootstrap() {
  const requiredPackages = ['chalk@4', 'inquirer@8', 'ora@5'];
  const missingPackages = [];

  for (const pkg of requiredPackages) {
    try {
      // Extract package name without version (e.g., 'chalk@4' -> 'chalk')
      const pkgName = pkg.split('@')[0];
      require.resolve(pkgName);
    } catch {
      missingPackages.push(pkg);
    }
  }

  if (missingPackages.length > 0) {
    console.log('\n📦 Installing setup wizard dependencies...');
    try {
      execSync(`npm install ${missingPackages.join(' ')} --no-save --legacy-peer-deps --loglevel=error`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
      console.log('✓ Dependencies installed\n');
    } catch (error) {
      console.error('Failed to install dependencies. Falling back to basic mode.');
      return false;
    }
  }

  return true;
}

// Fallback prompts using built-in readline
async function fallbackPrompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Main setup function with fancy UI
async function setupWithUI() {
  const chalk = require('chalk');
  const inquirer = require('inquirer');
  const ora = require('ora');

  // Welcome message
  console.log('\n' + chalk.cyan.bold('🚀 VAST Shopify Theme Setup Wizard'));
  console.log(chalk.gray('Let\'s get your development environment ready!\n'));

  // Step 1: Get store name
  const { storeName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'storeName',
      message: 'What\'s your Shopify store name?',
      suffix: chalk.gray(' (e.g., my-store from my-store.myshopify.com)'),
      validate: (input) => {
        if (!input) return 'Store name is required';
        if (!/^[a-zA-Z0-9-]+$/.test(input)) return 'Store name can only contain letters, numbers, and hyphens';
        return true;
      }
    }
  ]);

  // Step 2: Choose setup path
  console.log('\n' + chalk.bold('How would you like to set up your development theme?'));
  console.log(chalk.gray('Choose the option that best fits your situation:\n'));

  const { setupPath } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setupPath',
      message: 'Select setup method:',
      choices: [
        {
          name: chalk.green('Auto-create development theme') + chalk.cyan(' [RECOMMENDED FOR NEW USERS]'),
          value: 'auto',
          short: 'Auto-create'
        },
        new inquirer.Separator(chalk.gray('  → Shopify CLI will automatically create a temporary development theme')),
        new inquirer.Separator(chalk.gray('  → Best for first-time setup or quick starts')),
        new inquirer.Separator(),
        {
          name: 'Use existing theme',
          value: 'existing',
          short: 'Existing theme'
        },
        new inquirer.Separator(chalk.gray('  → Select from themes already on your store')),
        new inquirer.Separator(chalk.gray('  → Good for teams or when you have a development theme ready')),
        new inquirer.Separator(),
        {
          name: 'Create new unpublished theme',
          value: 'create',
          short: 'Create new'
        },
        new inquirer.Separator(chalk.gray('  → Creates a permanent unpublished theme with a custom name')),
        new inquirer.Separator(chalk.gray('  → Persists after logout, good for long-term development'))
      ],
      pageSize: 15
    }
  ]);

  // Step 3: Handle different setup paths
  let themeId;
  let themeName;
  let skipThemeId = false;

  if (setupPath === 'auto') {
    // Path 1: Auto-create development theme
    skipThemeId = true;
    themeName = 'Auto-created development theme';
    console.log('\n' + chalk.cyan('ℹ️  Shopify CLI will automatically create a development theme when you run npm run dev'));
  } else if (setupPath === 'create') {
    // Path 3: Create new unpublished theme
    console.log('\n' + chalk.bold('Create New Unpublished Theme:'));

    const { newThemeName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newThemeName',
        message: 'Enter a name for your new theme:',
        default: 'VAST Development',
        validate: (input) => {
          if (!input) return 'Theme name is required';
          return true;
        }
      }
    ]);

    const createSpinner = ora(`Creating theme "${newThemeName}"...`).start();

    try {
      // Build first so we have assets to push
      execSync('npm run build', {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..')
      });

      // Create new unpublished theme
      const output = execSync(`shopify theme push --unpublished --theme="${newThemeName}" --store=${storeName} --json`, {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
      });

      const result = JSON.parse(output);
      themeId = result.theme?.id;
      themeName = newThemeName;

      if (!themeId) {
        throw new Error('Failed to get theme ID from push command');
      }

      createSpinner.succeed(chalk.green(`Theme "${newThemeName}" created successfully (ID: ${themeId})`));
    } catch (error) {
      createSpinner.fail(chalk.red('Failed to create theme'));
      console.error(chalk.gray(error.message));

      console.log(chalk.yellow('\n⚠️  Consider using "Auto-create development theme" option instead.'));
      const { fallbackToAuto } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'fallbackToAuto',
          message: 'Would you like to continue with auto-create instead?',
          default: true
        }
      ]);

      if (fallbackToAuto) {
        skipThemeId = true;
        themeName = 'Auto-created development theme';
        console.log(chalk.cyan('✓ Switched to auto-create mode'));
      } else {
        console.log(chalk.red('\n❌ Setup cancelled.'));
        process.exit(1);
      }
    }
  } else {
    // Path 2: Use existing theme
    // Fetch themes from Shopify
    const spinner = ora('Fetching themes from Shopify...').start();
    let themes = [];
    let themeListError = null;

    try {
      const output = execSync(`shopify theme list --store=${storeName} --json`, {
        encoding: 'utf-8',
        cwd: path.join(__dirname, '..')
      });

      const data = JSON.parse(output);
      // Shopify CLI returns array directly, not { themes: [...] }
      themes = Array.isArray(data) ? data : (data.themes || []);
      spinner.succeed(chalk.green('Themes fetched successfully'));
      console.log('');
    } catch (error) {
      spinner.fail(chalk.red('Failed to fetch themes'));
      themeListError = error;

      // Check for common errors
      if (error.message.includes('not found') || error.message.includes('command not found')) {
        console.log(chalk.yellow('\n⚠️  Shopify CLI is not installed.'));
        console.log(chalk.gray('Install it with: npm install -g @shopify/cli@latest\n'));
      } else if (error.message.includes('auth') || error.message.includes('login')) {
        console.log(chalk.yellow('\n⚠️  You need to authenticate with Shopify.'));
        console.log(chalk.gray('Run: shopify auth login\n'));
      }
    }

    if (themes.length > 0) {
      // Find development themes and mark them as recommended
      const developmentThemes = themes.filter(t => t.role === 'development');
      const otherThemes = themes.filter(t => t.role !== 'development');

      // Build choices array
      const choices = [];

      if (developmentThemes.length > 0) {
        developmentThemes.forEach(theme => {
          choices.push({
            name: chalk.green(`${theme.name} (ID: ${theme.id})`) + chalk.cyan(' [RECOMMENDED]'),
            value: { id: theme.id, name: theme.name }
          });
        });
      }

      otherThemes.forEach(theme => {
        const roleLabel = theme.role === 'main' ? '[LIVE]' : '[UNPUBLISHED]';
        choices.push({
          name: `${theme.name} (ID: ${theme.id}) ${chalk.gray(roleLabel)}`,
          value: { id: theme.id, name: theme.name }
        });
      });

      choices.push(new inquirer.Separator());
      choices.push({
        name: 'Enter theme ID manually',
        value: 'manual'
      });

      const { selectedTheme } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedTheme',
          message: 'Select a theme for development:',
          choices: choices,
          pageSize: 10
        }
      ]);

      if (selectedTheme === 'manual') {
        const { manualId } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualId',
            message: 'Enter theme ID:',
            validate: (input) => {
              if (!input || isNaN(input)) return 'Please enter a valid theme ID';
              return true;
            }
          }
        ]);
        themeId = manualId;
        themeName = 'Custom Theme';
      } else {
        themeId = selectedTheme.id;
        themeName = selectedTheme.name;
      }
    } else {
      // Fallback to manual entry
      console.log(chalk.yellow('\n⚠️  No themes found. You\'ll need to enter a theme ID manually.'));
      console.log(chalk.gray('Find theme IDs in Shopify Admin → Online Store → Themes (check the URL)\n'));

      const { manualId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualId',
          message: 'Enter theme ID:',
          validate: (input) => {
            if (!input || isNaN(input)) return 'Please enter a valid theme ID';
            return true;
          }
        }
      ]);
      themeId = manualId;
      themeName = 'Custom Theme';
    }
  }

  // Step 4: Confirmation
  console.log('\n' + chalk.bold('Configuration Summary:'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`Store:  ${chalk.cyan(storeName)}.myshopify.com`);
  if (skipThemeId) {
    console.log(`Theme:  ${chalk.cyan(themeName)}`);
  } else {
    console.log(`Theme:  ${chalk.cyan(themeName)} ${chalk.gray(`(ID: ${themeId})`)}`);
  }
  console.log(chalk.gray('─'.repeat(50)) + '\n');

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Does this look correct?',
      default: true
    }
  ]);

  if (!confirm) {
    console.log(chalk.yellow('\n❌ Setup cancelled. Run npm run setup to try again.\n'));
    process.exit(0);
  }

  // Step 4.5: Ask about deployment workflow
  console.log('\n' + chalk.bold('How will you deploy changes to your store?'));
  console.log(chalk.gray('This configures .gitignore and recommends the right dev script for you.\n'));

  const { workflow } = await inquirer.prompt([
    {
      type: 'list',
      name: 'workflow',
      message: 'Select deployment strategy:',
      default: 'cli',
      choices: [
        {
          name: 'Shopify CLI (manual push)',
          value: 'cli',
          short: 'CLI push'
        },
        new inquirer.Separator(chalk.gray('  → You run `npm run deploy` to push changes to Shopify')),
        new inquirer.Separator(chalk.gray('  → Content managed in code; editor-side changes captured manually')),
        new inquirer.Separator(chalk.gray('  → Build artifacts stay out of git')),
        new inquirer.Separator(),
        {
          name: 'GitHub integration (automatic)',
          value: 'github',
          short: 'GitHub integration'
        },
        new inquirer.Separator(chalk.gray('  → Shopify syncs automatically when you push to GitHub')),
        new inquirer.Separator(chalk.gray('  → Merchants edit in the theme editor; Shopify commits changes back to your repo')),
        new inquirer.Separator(chalk.gray('  → Build artifacts must be tracked in git (wizard will adjust .gitignore)')),
        new inquirer.Separator(),
        {
          name: 'Not sure yet',
          value: 'unsure',
          short: 'Not sure'
        },
        new inquirer.Separator(chalk.gray('  → Defaults to Shopify CLI settings (safer, matches Shopify\'s own defaults)')),
        new inquirer.Separator(chalk.gray('  → Rerun this wizard anytime to switch'))
      ],
      pageSize: 18
    }
  ]);

  const effectiveWorkflow = workflow === 'unsure' ? 'cli' : workflow;

  // Step 5: Ask about production environment
  const { addProduction } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addProduction',
      message: 'Would you like to configure a production environment?',
      default: false
    }
  ]);

  let productionThemeId;
  let productionThemeName;

  if (addProduction) {
    console.log('\n' + chalk.bold('Configure Production Environment:'));
    console.log(chalk.gray('Select your live/main theme for production deployments.\n'));

    if (themes.length > 0) {
      // Find main/live theme and mark it as recommended for production
      const mainThemes = themes.filter(t => t.role === 'main');
      const otherThemes = themes.filter(t => t.role !== 'main');

      // Build choices array
      const prodChoices = [];

      if (mainThemes.length > 0) {
        mainThemes.forEach(theme => {
          prodChoices.push({
            name: chalk.red(`${theme.name} (ID: ${theme.id})`) + chalk.cyan(' [RECOMMENDED FOR PRODUCTION]'),
            value: { id: theme.id, name: theme.name }
          });
        });
      }

      otherThemes.forEach(theme => {
        const roleLabel = theme.role === 'development' ? '[DEV]' : '[UNPUBLISHED]';
        prodChoices.push({
          name: `${theme.name} (ID: ${theme.id}) ${chalk.gray(roleLabel)}`,
          value: { id: theme.id, name: theme.name }
        });
      });

      prodChoices.push(new inquirer.Separator());
      prodChoices.push({
        name: 'Enter theme ID manually',
        value: 'manual'
      });

      const { selectedProdTheme } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedProdTheme',
          message: 'Select a theme for production:',
          choices: prodChoices,
          pageSize: 10
        }
      ]);

      if (selectedProdTheme === 'manual') {
        const { manualProdId } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualProdId',
            message: 'Enter production theme ID:',
            validate: (input) => {
              if (!input || isNaN(input)) return 'Please enter a valid theme ID';
              return true;
            }
          }
        ]);
        productionThemeId = manualProdId;
        productionThemeName = 'Production Theme';
      } else {
        productionThemeId = selectedProdTheme.id;
        productionThemeName = selectedProdTheme.name;
      }
    } else {
      // Fallback to manual entry
      console.log(chalk.yellow('\n⚠️  No themes found. You\'ll need to enter a theme ID manually.\n'));

      const { manualProdId } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualProdId',
          message: 'Enter production theme ID:',
          validate: (input) => {
            if (!input || isNaN(input)) return 'Please enter a valid theme ID';
            return true;
          }
        }
      ]);
      productionThemeId = manualProdId;
      productionThemeName = 'Production Theme';
    }

    console.log('\n' + chalk.bold('Final Configuration Summary:'));
    console.log(chalk.gray('─'.repeat(50)));
    console.log(`Store:        ${chalk.cyan(storeName)}.myshopify.com`);
    console.log(`Development:  ${chalk.cyan(themeName)} ${chalk.gray(`(ID: ${themeId})`)}`);
    console.log(`Production:   ${chalk.red(productionThemeName)} ${chalk.gray(`(ID: ${productionThemeId})`)}`);
    console.log(chalk.gray('─'.repeat(50)) + '\n');

    const { finalConfirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'finalConfirm',
        message: 'Does this look correct?',
        default: true
      }
    ]);

    if (!finalConfirm) {
      console.log(chalk.yellow('\n❌ Setup cancelled. Run npm run setup to try again.\n'));
      process.exit(0);
    }
  }

  // Step 6: Check if shopify.theme.toml already exists
  const tomlPath = path.join(__dirname, '..', 'shopify.theme.toml');
  if (fs.existsSync(tomlPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: chalk.yellow('shopify.theme.toml already exists. Overwrite?'),
        default: false
      }
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\n❌ Setup cancelled to preserve existing configuration.\n'));
      process.exit(0);
    }
  }

  // Step 7: Generate shopify.theme.toml
  let tomlContent;

  if (skipThemeId) {
    // Auto-create mode: only store name, no theme ID
    tomlContent = `[environments.development]
store = "${storeName}"
`;
  } else {
    // Existing or created theme: include theme ID
    tomlContent = `[environments.development]
store = "${storeName}"
theme = "${themeId}"
`;
  }

  if (addProduction) {
    tomlContent += `
[environments.production]
store = "${storeName}"
theme = "${productionThemeId}"
`;
  }

  try {
    fs.writeFileSync(tomlPath, tomlContent, 'utf-8');
    console.log(chalk.green('\n✓ Created shopify.theme.toml'));
  } catch (error) {
    console.error(chalk.red('\n✗ Failed to create shopify.theme.toml:'), error.message);
    process.exit(1);
  }

  // Step 8: Install dependencies
  console.log('\n' + chalk.bold('Installing dependencies...'));
  const installSpinner = ora('Running npm install --legacy-peer-deps...').start();

  try {
    execSync('npm install --legacy-peer-deps', {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    installSpinner.succeed(chalk.green('Dependencies installed'));
  } catch (error) {
    installSpinner.fail(chalk.red('Failed to install dependencies'));
    console.error(chalk.gray(error.message));
    process.exit(1);
  }

  // Step 9: Build theme assets
  console.log('\n' + chalk.bold('Building theme assets...'));
  const buildSpinner = ora('Running initial build (this creates the assets folder)...').start();

  try {
    execSync('npm run build', {
      stdio: 'pipe',
      cwd: path.join(__dirname, '..')
    });
    buildSpinner.succeed(chalk.green('Initial build complete'));
  } catch (error) {
    buildSpinner.fail(chalk.red('Build failed'));
    console.error(chalk.gray(error.message));
    process.exit(1);
  }

  // Step 10: Configure .gitignore based on deployment workflow
  const gitignorePath = path.join(__dirname, '..', '.gitignore');
  const gitignoreSpinner = ora('Configuring .gitignore for your workflow...').start();

  const MARKER_START = '# >>> VAST setup: gitignore block <<<';
  const MARKER_END = '# >>> end VAST setup <<<';
  const managedBlock = [
    MARKER_START,
    '# Managed by scripts/setup.cjs — safe to delete this block manually.',
    'assets/',
    'snippets/vite.liquid',
    MARKER_END,
    ''
  ].join('\n');

  try {
    if (fs.existsSync(gitignorePath)) {
      let gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');

      // Remove any existing managed block (idempotent across reruns)
      const blockRegex = /\n?# >>> VAST setup: gitignore block <<<[\s\S]*?# >>> end VAST setup <<<\n?/g;
      gitignoreContent = gitignoreContent.replace(blockRegex, '');

      // Strip bare legacy lines from pre-marker-block wizard versions
      gitignoreContent = gitignoreContent
        .split('\n')
        .filter(line => {
          const trimmed = line.trim();
          return trimmed !== '/assets/*'
            && trimmed !== '!/assets/.gitkeep'
            && trimmed !== '/snippets/vite.liquid'
            && trimmed !== 'assets/'
            && trimmed !== 'snippets/vite.liquid';
        })
        .join('\n');

      // Normalize to exactly one trailing newline (keeps mutation idempotent
      // across direction swaps regardless of the input file's trailing-newline style)
      gitignoreContent = gitignoreContent.replace(/\n+$/, '') + '\n';

      if (effectiveWorkflow === 'cli') {
        gitignoreContent += '\n' + managedBlock;
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
        gitignoreSpinner.succeed(chalk.green('Configured .gitignore to ignore build artifacts (CLI push workflow)'));
      } else {
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf-8');
        gitignoreSpinner.succeed(chalk.green('Configured .gitignore for Shopify GitHub integration (build artifacts tracked)'));
      }
    } else {
      gitignoreSpinner.warn(chalk.yellow('.gitignore not found, skipping'));
    }
  } catch (error) {
    gitignoreSpinner.fail(chalk.red('Failed to configure .gitignore'));
    console.error(chalk.gray(error.message));
    // Don't exit - this is not critical
  }

  // Success message
  console.log('\n' + chalk.green.bold('✨ Setup Complete!'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log('\n' + chalk.bold('Next Steps:'));

  if (effectiveWorkflow === 'github') {
    console.log(chalk.gray('1.') + ' Start the development server:');
    console.log('   ' + chalk.cyan('npm run dev:sync'));
    console.log(chalk.gray('   Pulls theme-editor changes back into your working tree.'));
  } else {
    console.log(chalk.gray('1.') + ' Start the development server:');
    console.log('   ' + chalk.cyan('npm run dev'));
    console.log(chalk.gray('   One-way sync (local → Shopify). Safer default.'));
  }

  if (skipThemeId) {
    console.log('\n' + chalk.cyan('ℹ️  On first run, Shopify CLI will:'));
    console.log(chalk.gray('   • Automatically create a new development theme'));
    console.log(chalk.gray('   • Upload your theme files to it'));
    console.log(chalk.gray('   • Provide preview and editor URLs'));
  }

  console.log('\n' + chalk.gray('2.') + ' Open your theme preview in the browser:');
  console.log('   ' + chalk.cyan('http://127.0.0.1:9292'));

  if (addProduction) {
    console.log(chalk.gray('3.') + ' Deploy to production when ready:');
    if (effectiveWorkflow === 'github') {
      console.log('   ' + chalk.cyan('git push') + chalk.gray(' — Shopify syncs automatically'));
    } else {
      console.log('   ' + chalk.cyan('npm run deploy'));
    }
  }

  console.log('\n' + chalk.gray('─'.repeat(50)));

  console.log('\n' + chalk.cyan('ℹ️  About dev scripts:'));
  if (effectiveWorkflow === 'github') {
    console.log(chalk.gray('   • ') + chalk.cyan('npm run dev:sync') + chalk.gray('  → editor changes flow back to your working tree'));
    console.log(chalk.gray('   • ') + chalk.cyan('npm run dev') + chalk.gray('       → no round-trip; use ') + chalk.cyan('npm run shopify:pull') + chalk.gray(' to capture manually'));
  } else {
    console.log(chalk.gray('   • ') + chalk.cyan('npm run dev') + chalk.gray('       → pushes local to Shopify; editor changes discarded'));
    console.log(chalk.gray('   • ') + chalk.cyan('npm run dev:sync') + chalk.gray('  → adds --theme-editor-sync; editor changes flow back'));
  }

  if (workflow === 'unsure') {
    console.log('\n' + chalk.yellow('ℹ️  You chose "Not sure yet" — the wizard set up the safer defaults.'));
    console.log(chalk.gray('   If you later connect your repo to Shopify via GitHub integration, rerun'));
    console.log(chalk.gray('   ') + chalk.cyan('npm run setup') + chalk.gray(' and pick "GitHub integration" to switch.'));
  }

  console.log('\n' + chalk.gray('Tip: For faster HMR, use ') + chalk.cyan('npm run dev:vite-server'));
  if (effectiveWorkflow === 'github') {
    console.log(chalk.gray('     or ') + chalk.cyan('npm run dev:vite-server:sync') + chalk.gray(' for the synced variant.'));
  } else {
    console.log(chalk.gray('     (Requires accepting SSL cert at https://127.0.0.1:3000 first)'));
  }

  if (setupPath === 'create') {
    console.log(chalk.gray('\nNote: Your unpublished theme "' + themeName + '" has been created.'));
    console.log(chalk.gray('      It will persist on your store even after logout.'));
  }

  console.log('');
}

// Main execution
(async () => {
  try {
    const hasUI = await bootstrap();

    if (hasUI) {
      await setupWithUI();
    } else {
      // Fallback to basic prompts
      console.log('\n🚀 VAST Shopify Theme Setup (Basic Mode)\n');

      const storeName = await fallbackPrompt('Enter your Shopify store name (e.g., my-store): ');
      const themeId = await fallbackPrompt('Enter your theme ID: ');

      const tomlPath = path.join(__dirname, '..', 'shopify.theme.toml');
      const tomlContent = `[environments.development]\nstore = "${storeName}"\ntheme = "${themeId}"\n`;

      fs.writeFileSync(tomlPath, tomlContent, 'utf-8');
      console.log('\n✓ Created shopify.theme.toml');
      console.log('\nRun: npm install --legacy-peer-deps');
      console.log('Then: npm run dev\n');
    }
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
})();
