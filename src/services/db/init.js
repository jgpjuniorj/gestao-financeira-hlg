import { initializeSchema } from './migrations.js';

let initializationPromise;

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await initializeSchema();
    })();
  }
  return initializationPromise;
}
