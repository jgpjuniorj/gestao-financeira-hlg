#!/usr/bin/env node
import process from 'node:process';
import { initializeDatabase, createHousehold } from '../src/services/db.js';

function parseArgs(argv) {
  const result = { name: '', slug: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (key === '--name' || key === '-n') {
      result.name = value || '';
      index += 1;
    } else if (key === '--slug' || key === '-s') {
      result.slug = value || '';
      index += 1;
    }
  }
  return result;
}

async function main() {
  const { name, slug } = parseArgs(process.argv.slice(2));

  if (!name || typeof name !== 'string') {
    console.error('Uso: node scripts/create-tenant.js --name "Nome do Ambiente" [--slug ambiente-slug]');
    process.exitCode = 1;
    return;
  }

  await initializeDatabase();
  const household = await createHousehold(name, slug);

  console.log('Ambiente criado com sucesso:');
  console.log(`  id:   ${household.id}`);
  console.log(`  nome: ${household.name}`);
  console.log(`  slug: ${household.slug}`);
}

main().catch(error => {
  console.error('Falha ao criar ambiente:', error.message || error);
  process.exitCode = 1;
});
