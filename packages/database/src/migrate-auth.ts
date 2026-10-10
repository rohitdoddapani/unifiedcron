import { migrate } from './migrate';

/**
 * Backward-compatible auth migration entrypoint.
 * The unified migration pipeline now applies auth schema and all ordered migrations.
 */
export async function migrateAuth() {
  await migrate();
}

if (require.main === module) {
  migrateAuth();
}
