import { query } from '@unifiedcron/database';

const DEFAULT_USER_EMAIL = 'admin@unifiedcron.com';

/**
 * Gets or creates a default user for development
 * Returns the user ID
 */
export async function getDefaultUserId(): Promise<string> {
  try {
    // Try to get existing user
    const result = await query(
      'SELECT id FROM users WHERE email = $1',
      [DEFAULT_USER_EMAIL]
    );

    if (result.rows.length > 0) {
      return result.rows[0].id;
    }

    // Create new user if doesn't exist
    const createResult = await query(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING id',
      [DEFAULT_USER_EMAIL, 'Development Admin']
    );

    return createResult.rows[0].id;
  } catch (error) {
    console.error('Error getting default user:', error);
    // Return a fallback UUID (not ideal but allows API to continue)
    return '00000000-0000-0000-0000-000000000000';
  }
}
