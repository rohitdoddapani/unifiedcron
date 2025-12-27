import { query } from '@unifiedcron/database';
import { encrypt, decrypt, maskSecret } from '@unifiedcron/shared';
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
      'SELECT * FROM connections WHERE "userId" = $1 ORDER BY "createdAt" DESC',
      [userId]
    );

    // Decrypt config for each connection
    const connections = await Promise.all(
      result.rows.map(async (row: { config: { encrypted?: string } } & Record<string, unknown>) => ({
        ...row,
        config: await this.decryptConfig(row.config.encrypted || row.config)
      }))
    );

    return connections;
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
    const configData = connection.config;
    return {
      ...connection,
      config: await this.decryptConfig(configData.encrypted || configData)
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

      const supabaseResult = await integrations.validateSupabaseAccess(
        connection.config.projectUrl!,
        connection.config.anonKey!
      );
      return {
        success: supabaseResult,
        message: supabaseResult ? 'Connection successful' : 'Failed to connect to Supabase'
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      return {
        success: false,
        message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async encryptConfig(config: ConnectionConfig): Promise<any> {
    const configStr = JSON.stringify(config);
    return await encrypt(configStr, this.encryptionKey);
  }

  private async decryptConfig(encryptedConfig: string | { encrypted: string }): Promise<ConnectionConfig> {
    try {
      // Handle both old format (string) and new format (object with encrypted field)
      const encryptedStr = typeof encryptedConfig === 'string' 
        ? encryptedConfig 
        : encryptedConfig.encrypted;
      
      const configStr = await decrypt(encryptedStr, this.encryptionKey);
      return JSON.parse(configStr);
    } catch (error) {
      console.error('Failed to decrypt config:', error);
      return {} as ConnectionConfig;
    }
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
