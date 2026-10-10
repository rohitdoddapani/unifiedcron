import { Router, IRouter } from 'express';
import { ConnectionService } from '../services/ConnectionService';
import { AuthRequest } from '../middleware/auth';

const router: IRouter = Router();

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
      data: connection
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
    const userId = (req as AuthRequest).userId!;
    const { label, config } = req.body;

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
