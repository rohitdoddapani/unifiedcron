import { Router } from 'express';
import { ConnectionService } from '../services/ConnectionService';
import { Platform, ConnectionConfig } from '@unifiedcron/shared';

const router = Router();

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
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const connections = await getConnectionService().getConnections(userId);
    res.json({
      success: true,
      data: connections
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific connection
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    const connection = await getConnectionService().getConnection(id, userId);
    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      data: connection
    });
  } catch (error) {
    next(error);
  }
});

// Create a new connection
router.post('/', async (req, res, next) => {
  try {
    const { userId, platform, label, config } = req.body;

    if (!userId || !platform || !label || !config) {
      return res.status(400).json({
        success: false,
        error: 'userId, platform, label, and config are required'
      });
    }

    // Validate platform - Currently only Supabase is supported
    if (platform !== 'supabase') {
      return res.status(400).json({
        success: false,
        error: `Only 'supabase' platform is currently supported. Other platforms will be added in future releases.`
      });
    }

    const connection = await getConnectionService().createConnection({
      userId,
      platform,
      label,
      config
    });

    res.status(201).json({
      success: true,
      data: connection
    });
  } catch (error) {
    next(error);
  }
});

// Update a connection
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, label, config } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const connection = await getConnectionService().updateConnection(id, userId, {
      label,
      config
    });

    if (!connection) {
      return res.status(404).json({
        success: false,
        error: 'Connection not found'
      });
    }

    res.json({
      success: true,
      data: connection
    });
  } catch (error) {
    next(error);
  }
});

// Delete a connection
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

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
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

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
