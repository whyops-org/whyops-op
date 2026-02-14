#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const args = { key: '', value: '' };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];

    if (current === '-k' || current === '--key') {
      args.key = argv[i + 1] || '';
      i += 1;
      continue;
    }

    if (current === '-v' || current === '--value') {
      args.value = argv[i + 1] || '';
      i += 1;
      continue;
    }
  }

  return args;
}

function validateEnvKey(key) {
  return /^[A-Z][A-Z0-9_]*$/.test(key);
}

function readIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return '';
  }

  return fs.readFileSync(filePath, 'utf8');
}

function ensureTrailingNewline(content) {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function upsertEnvKeyValue(content, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');
  const line = `${key}=${value}`;

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const normalized = ensureTrailingNewline(content);
  return `${normalized}${line}\n`;
}

function ensureEnvExampleKey(content, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedKey}=.*$`, 'm');

  if (pattern.test(content)) {
    return content;
  }

  const normalized = ensureTrailingNewline(content);
  return `${normalized}${key}=\n`;
}

function upsertEnvSchema(content, key) {
  const schemaBlockPattern = /const envSchema = z\.object\(\{([\s\S]*?)\n\}\);/;
  const match = content.match(schemaBlockPattern);

  if (!match) {
    throw new Error('Could not find envSchema object in shared/src/config/env.ts');
  }

  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const fieldPattern = new RegExp(`^\\s*${escapedKey}:\\s*.*,$`, 'm');
  const schemaField = `  ${key}: z.string().optional(),`;

  const objectBody = match[1];
  let updatedBody;

  if (fieldPattern.test(objectBody)) {
    return content;
  }

  updatedBody = `${objectBody}\n${schemaField}`;

  return content.replace(schemaBlockPattern, `const envSchema = z.object({${updatedBody}\n});`);
}

function writeFile(filePath, content) {
  fs.writeFileSync(filePath, content, 'utf8');
}

function main() {
  const { key, value } = parseArgs(process.argv.slice(2));

  if (!key || value === '') {
    console.error('Usage: bun run env-add -- -k KEY -v VALUE');
    process.exit(1);
  }

  if (!validateEnvKey(key)) {
    console.error('Invalid key. Use uppercase environment variable style, e.g. MY_NEW_KEY');
    process.exit(1);
  }

  const root = process.cwd();
  const envPath = path.join(root, '.env');
  const envExamplePath = path.join(root, '.env.example');
  const envTsPath = path.join(root, 'shared', 'src', 'config', 'env.ts');

  const envContent = readIfExists(envPath);
  const envExampleContent = readIfExists(envExamplePath);
  const envTsContent = readIfExists(envTsPath);

  const updatedEnv = upsertEnvKeyValue(envContent, key, value);
  const updatedEnvExample = ensureEnvExampleKey(envExampleContent, key);
  const updatedEnvTs = upsertEnvSchema(envTsContent, key);

  writeFile(envPath, updatedEnv);
  writeFile(envExamplePath, updatedEnvExample);
  writeFile(envTsPath, updatedEnvTs);

  console.log(`Added/updated ${key} in .env, .env.example, and shared/src/config/env.ts`);
}

main();