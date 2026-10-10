import { query } from '@unifiedcron/database';
import { decrypt } from '@unifiedcron/shared';
import { Connection, ConnectionConfig } from '@unifiedcron/shared';

export class ConnectionService {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
  }

  async getConnection(id: string, userId: string): Promise<Connection | null> {
    const result = await query(
      'SELECT * FROM connections WHERE id = $1 AND "userId" = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const connection = result.rows[0];
    return {
      ...connection,
      config: await this.decryptConfig(connection.config)
    };
  }

  async getDecryptedConfig(connectionId: string): Promise<ConnectionConfig | null> {
    const result = await query(
      'SELECT config FROM connections WHERE id = $1',
      [connectionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return await this.decryptConfig(result.rows[0].config);
  }

  private async decryptConfig(encryptedConfig: string | { encrypted?: string }): Promise<ConnectionConfig> {
    try {
      const encryptedStr = this.extractEncryptedString(encryptedConfig);
      const configStr = await decrypt(encryptedStr, this.encryptionKey);
      return JSON.parse(configStr);
    } catch (error) {
      console.error('Failed to decrypt config:', error);
      return {} as ConnectionConfig;
    }
  }

  private extractEncryptedString(value: string | { encrypted?: string }): string {
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as { encrypted?: string };
        if (parsed && typeof parsed.encrypted === 'string') {
          return parsed.encrypted;
        }
      } catch (error) {
        // Best effort for compatibility with raw encrypted strings.
      }
      return value;
    }

    if (!value.encrypted) {
      throw new Error('Missing encrypted payload');
    }

    return value.encrypted;
  }
}
