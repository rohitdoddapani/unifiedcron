import { Router, IRouter } from 'express';
import { ConnectionService } from '../services/ConnectionService';
import { AuthRequest } from '../middleware/auth';
import { z, Connection } from '@unifiedcron/shared';
import { supabaseSetupSql, validateSupabaseAccess, supabaseProjectIdentity } from '@unifiedcron/integrations';
import { randomBytes } from 'crypto';

const router: IRouter = Router();
const secureConfig = z.object({ mode: z.literal('postgres'), connectionString: z.string().min(1).max(4096), caCertificate: z.string().max(65536).optional() }).strict();
async function verifyConfig(config: z.infer<typeof secureConfig>) {
  try { await validateSupabaseAccess(config); }
  catch (cause) {
    const error = new Error(cause instanceof Error ? cause.message.slice(0,512) : 'Secure connection validation failed');
    error.name = 'SupabaseConnectionError'; throw error;
  }
}
function publicConnection(connection: Connection) {
  return { ...connection, config: { mode: connection.config.mode === 'postgres' ? 'postgres' : 'legacy_anon' },
    migrationRequired: connection.config.mode !== 'postgres' };
}

router.get('/supabase/setup', (_req, res) => {
  const password = randomBytes(32).toString('hex');
  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, data: { sql: supabaseSetupSql(password), username: 'unifiedcron_reader' } });
});

// Lazy initialization - create service instance when first needed
let connectionService: ConnectionService | null = null;

function getConnectionService(): ConnectionService {
  if (!connectionService) {
    connectionService = new ConnectionService();
  }
  return connectionService;
}

// Get all connections for a user
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;

    const connections = await getConnectionService().getConnections(userId);
    res.json({
      success: true,
      data: connections.map(publicConnection)
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific connection
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;

    const connection = await getConnectionService().getConnection(id, userId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      data: publicConnection(connection)
    });
  } catch (error) {
    next(error);
  }
});

// Create a new connection
router.post('/', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { platform, label, config } = req.body;

    if (!platform || !label || !config) {
      return res.status(400).json({
        success: false,
        error: 'platform, label, and config are required'
      });
    }

    // Validate platform - Currently only Supabase is supported
    if (platform !== 'supabase') {
      return res.status(400).json({
        success: false,
        error: `Only 'supabase' platform is currently supported. Other platforms will be added in future releases.`
      });
    }

    const validated = secureConfig.parse(config);
    await verifyConfig(validated);
    const connection = await getConnectionService().createConnection({
      userId,
      platform,
      label,
      config: validated
    });

    res.status(201).json({
      success: true,
      data: publicConnection(connection)
    });
  } catch (error) {
    next(error);
  }
});

// Update a connection
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;
    const { label, config } = req.body;

    const existing = await getConnectionService().getConnection(id, userId);
    if (!existing) return res.status(404).json({ success: false, error: 'Connection not found' });
    const validated = config === undefined ? undefined : secureConfig.parse(config);
    if (validated) {
      const before = supabaseProjectIdentity(existing.config);
      if (before && before !== supabaseProjectIdentity(validated)) {
        const error = new Error('Create a new connection for a different project or database; existing history and cursors must keep their original source.');
        error.name = 'SupabaseConnectionError'; throw error;
      }
    }
    if (validated) await verifyConfig(validated);

    const connection = await getConnectionService().updateConnection(id, userId, {
      label,
      config: validated
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      data: publicConnection(connection)
    });
  } catch (error) {
    next(error);
  }
});

// Delete a connection
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;

    const deleted = await getConnectionService().deleteConnection(id, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      message: 'Connection deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// Test a connection
router.post('/:id/test', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;

    const result = await getConnectionService().testConnection(id, userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export { router as connectionsRouter };
