import { query } from '@unifiedcron/database';
import { encrypt, decrypt } from '@unifiedcron/shared';
import { Connection, ConnectionConfig, Platform } from '@unifiedcron/shared';
import * as integrations from '@unifiedcron/integrations';

export class ConnectionService {
  private encryptionKey: string;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || '';
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
  }

  async getConnections(userId: string): Promise<Connection[]> {
    const result = await query(
      `SELECT c.*, row_to_json(s) AS ingestion,
        (SELECT count(*) FROM ingestion_gaps g WHERE g."connectionId"=c.id) AS "historyGaps"
       FROM connections c LEFT JOIN ingestion_state s ON s."connectionId"=c.id AND s.stream='supabase.runs'
       WHERE c."userId" = $1 ORDER BY c."createdAt" DESC`,
      [userId]
    );

    // Decrypt config for each connection
    const connections = await Promise.all(
      result.rows.map(async (row: Record<string, unknown>) => {
        const configData = row.config as { encrypted?: string } | string;
        const encryptedValue = typeof configData === 'object' && configData.encrypted
          ? configData.encrypted
          : (configData as string);
        return {
          ...row,
          config: await this.decryptConfig(encryptedValue)
        };
      })
    );

    return connections;
  }

  async getConnection(id: string, userId: string): Promise<Connection | null> {
    const result = await query(
      `SELECT c.*, row_to_json(s) AS ingestion,
        (SELECT count(*) FROM ingestion_gaps g WHERE g."connectionId"=c.id) AS "historyGaps"
       FROM connections c LEFT JOIN ingestion_state s ON s."connectionId"=c.id AND s.stream='supabase.runs'
       WHERE c.id=$1 AND c."userId"=$2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const connection = result.rows[0];
    const configData = connection.config as { encrypted?: string } | string;
    return {
      ...connection,
      config: await this.decryptConfig(configData)
    };
  }

  async createConnection(data: {
    userId: string;
    platform: Platform;
    label: string;
    config: ConnectionConfig;
  }): Promise<Connection> {
    const { userId, platform, label, config } = data;

    // Encrypt the config before storing
    const encryptedConfig = await this.encryptConfig(config);

    // Store encrypted config as JSONB - wrap in object with encrypted field
    const result = await query(
      `INSERT INTO connections ("userId", platform, label, config)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING *`,
      [userId, platform, label, JSON.stringify({ encrypted: encryptedConfig })]
    );

    return {
      ...result.rows[0],
      config // Return unencrypted config to client
    };
  }

  async updateConnection(
    id: string,
    userId: string,
    updates: { label?: string; config?: ConnectionConfig }
  ): Promise<Connection | null> {
    const { label, config } = updates;
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (label !== undefined) {
      updateFields.push(`label = $${paramCount++}`);
      values.push(label);
    }

    if (config !== undefined) {
      const encryptedConfig = await this.encryptConfig(config);
      updateFields.push(`config = $${paramCount++}::jsonb`);
      values.push(JSON.stringify({ encrypted: encryptedConfig }));
    }

    if (updateFields.length === 0) {
      return this.getConnection(id, userId);
    }

    values.push(id, userId);

    const result = await query(
      `UPDATE connections 
       SET ${updateFields.join(', ')}, "updatedAt" = NOW()
       WHERE id = $${paramCount++} AND "userId" = $${paramCount++}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return null;
    }

    const configData = result.rows[0].config;
    return {
      ...result.rows[0],
      config: await this.decryptConfig(configData.encrypted || configData) // Return unencrypted config to client
    };
  }

  async deleteConnection(id: string, userId: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM connections WHERE id = $1 AND "userId" = $2',
      [id, userId]
    );

    return result.rowCount > 0;
  }

  async testConnection(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const connection = await this.getConnection(id, userId);
    if (!connection) {
      throw new Error('Connection not found');
    }

    try {
      // Currently only Supabase is supported
      if (connection.platform !== 'supabase') {
        return {
          success: false,
          message: `Platform '${connection.platform}' is not supported. Only Supabase is currently available.`
        };
      }

      const supabaseResult = await integrations.validateSupabaseAccess(connection.config);
      return {
        success: supabaseResult,
        message: supabaseResult ? 'Verified TLS and least-privilege reader access' : 'Failed to connect to Supabase'
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async encryptConfig(config: ConnectionConfig): Promise<string> {
    const configStr = JSON.stringify(config);
    return await encrypt(configStr, this.encryptionKey);
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
      // Legacy rows can store JSON stringified object payloads.
      try {
        const parsed = JSON.parse(value) as { encrypted?: string };
        if (parsed && typeof parsed.encrypted === 'string') {
          return parsed.encrypted;
        }
      } catch (error) {
        // Not a JSON payload; treat as raw encrypted text.
      }
      return value;
    }

    if (!value.encrypted) {
      throw new Error('Missing encrypted payload');
    }

    return value.encrypted;
  }

  // Helper method to get decrypted config for internal use
  async getDecryptedConfig(connectionId: string): Promise<ConnectionConfig | null> {
    const result = await query(
      'SELECT config FROM connections WHERE id = $1',
      [connectionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const configData = result.rows[0].config;
    return await this.decryptConfig(configData.encrypted || configData);
  }
}
