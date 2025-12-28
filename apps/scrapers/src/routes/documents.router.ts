/**
 * Court Documents Router
 * REST API for court document management
 */

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { logger } from '../lib/logger';
import {
  createDocumentStorage,
  verifyToken,
  generateContentDisposition,
  parseDocumentKey,
  formatBytes,
  createUsageTracker,
} from '../court/storage';

/**
 * Environment bindings
 */
interface Env {
  DATABASE_URL: string;
  COURT_DOCS: R2Bucket;
  COURT_SESSIONS: KVNamespace;
  MERIDIAN_SECRET_KEY: string;
}

/**
 * Create documents router
 */
export function createDocumentsRouter() {
  const router = new Hono<{ Bindings: Env }>();

  /**
   * List documents for a case
   * GET /documents/:courtId/:caseNumber
   */
  router.get('/:courtId/:caseNumber', async (c) => {
    const { courtId, caseNumber } = c.req.param();

    try {
      const storage = createDocumentStorage(
        c.env.COURT_DOCS,
        c.env.COURT_SESSIONS,
        c.env.MERIDIAN_SECRET_KEY
      );

      const documents = await storage.listDocuments(courtId, caseNumber);

      return c.json({
        success: true,
        courtId,
        caseNumber,
        count: documents.length,
        documents: documents.map(doc => ({
          ...doc,
          sizeFormatted: formatBytes(doc.sizeBytes),
        })),
      });
    } catch (error) {
      logger.error('Failed to list documents', { courtId, caseNumber, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to list documents' });
    }
  });

  /**
   * Get document metadata
   * GET /documents/:courtId/:caseNumber/:documentId
   */
  router.get('/:courtId/:caseNumber/:documentId', async (c) => {
    const { courtId, caseNumber, documentId } = c.req.param();

    try {
      const storage = createDocumentStorage(
        c.env.COURT_DOCS,
        c.env.COURT_SESSIONS,
        c.env.MERIDIAN_SECRET_KEY
      );

      const history = await storage.getVersionHistory({
        courtId,
        caseNumber,
        documentId,
      });

      if (history.versions.length === 0) {
        throw new HTTPException(404, { message: 'Document not found' });
      }

      // Get OCR text if available
      const ocrText = await storage.getOcrText({
        courtId,
        caseNumber,
        documentId,
        version: history.currentVersion,
      });

      return c.json({
        success: true,
        documentId,
        currentVersion: history.currentVersion,
        versions: history.versions.map(v => ({
          ...v,
          sizeFormatted: formatBytes(v.sizeBytes),
        })),
        createdAt: history.createdAt.toISOString(),
        lastModifiedAt: history.lastModifiedAt.toISOString(),
        hasOcr: !!ocrText,
        ocrPreview: ocrText?.substring(0, 500),
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to get document', { documentId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get document' });
    }
  });

  /**
   * Get presigned download URL
   * GET /documents/:courtId/:caseNumber/:documentId/download
   */
  router.get('/:courtId/:caseNumber/:documentId/download', async (c) => {
    const { courtId, caseNumber, documentId } = c.req.param();
    const version = c.req.query('version');

    try {
      const storage = createDocumentStorage(
        c.env.COURT_DOCS,
        c.env.COURT_SESSIONS,
        c.env.MERIDIAN_SECRET_KEY
      );

      const presignedUrl = await storage.getDownloadUrl(
        {
          courtId,
          caseNumber,
          documentId,
          version: version ? parseInt(version, 10) : undefined,
        },
        {
          expiresIn: 3600,
          contentDisposition: 'attachment',
        }
      );

      if (!presignedUrl) {
        throw new HTTPException(404, { message: 'Document not found' });
      }

      return c.json({
        success: true,
        downloadUrl: presignedUrl.url,
        expiresAt: presignedUrl.expiresAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to get download URL', { documentId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to generate download URL' });
    }
  });

  /**
   * Download document via token
   * GET /documents/download?token=xxx
   */
  router.get('/download', async (c) => {
    const token = c.req.query('token');

    if (!token) {
      throw new HTTPException(400, { message: 'Token is required' });
    }

    try {
      const verification = await verifyToken(token, c.env.MERIDIAN_SECRET_KEY);

      if (!verification.valid) {
        throw new HTTPException(401, { message: verification.error || 'Invalid token' });
      }

      const payload = verification.payload as { key: string; method: string };

      if (payload.method !== 'GET') {
        throw new HTTPException(405, { message: 'Method not allowed' });
      }

      // Get the document from R2
      const object = await c.env.COURT_DOCS.get(payload.key);

      if (!object) {
        throw new HTTPException(404, { message: 'Document not found' });
      }

      // Parse key to get document info
      const parsed = parseDocumentKey(payload.key);
      const fileName = parsed?.documentId || 'document';

      // Set response headers
      const headers = new Headers();
      headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
      headers.set('Content-Length', object.size.toString());
      headers.set('Content-Disposition', generateContentDisposition('attachment', fileName));
      headers.set('Cache-Control', 'private, max-age=3600');

      // Handle compression
      const isCompressed = object.customMetadata?.['x-compressed'] === 'true';
      if (isCompressed) {
        headers.set('Content-Encoding', 'gzip');
      }

      return new Response(object.body, { headers });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to download document', { error: String(error) });
      throw new HTTPException(500, { message: 'Failed to download document' });
    }
  });

  /**
   * Upload a document
   * POST /documents/:courtId/:caseNumber
   */
  router.post('/:courtId/:caseNumber', async (c) => {
    const { courtId, caseNumber } = c.req.param();
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID is required' });
    }

    try {
      // Check usage limits
      const usageTracker = createUsageTracker(c.env.COURT_SESSIONS);
      const contentLength = parseInt(c.req.header('Content-Length') || '0', 10);

      const usageCheck = await usageTracker.checkCanUpload(
        userId,
        'free',  // Default to free tier
        contentLength
      );

      if (!usageCheck.allowed) {
        throw new HTTPException(429, {
          message: usageCheck.reason || 'Usage limit exceeded',
        });
      }

      // Parse multipart form data
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      const title = formData.get('title') as string || file?.name || 'document';
      const documentType = formData.get('documentType') as string || 'filing';
      const processOcr = formData.get('processOcr') === 'true';

      if (!file) {
        throw new HTTPException(400, { message: 'File is required' });
      }

      const storage = createDocumentStorage(
        c.env.COURT_DOCS,
        c.env.COURT_SESSIONS,
        c.env.MERIDIAN_SECRET_KEY
      );

      // Create document info
      const docInfo = {
        id: crypto.randomUUID(),
        caseNumber,
        title,
        documentType,
        filedDate: new Date(),
        url: '',
      };

      // Upload
      const data = await file.arrayBuffer();
      const result = await storage.uploadDocument(docInfo, data, {
        caseId: 0,  // Would be fetched from database
        courtId,
        uploadedBy: userId,
        compress: true,
        processOcr,
      });

      if (!result.success) {
        throw new HTTPException(500, { message: result.error || 'Upload failed' });
      }

      // Update usage
      await usageTracker.updateUsage(userId, courtId, {
        documents: 1,
        bytes: result.sizeBytes,
      });

      return c.json({
        success: true,
        documentId: result.documentId,
        version: result.version,
        sizeBytes: result.sizeBytes,
        sizeFormatted: formatBytes(result.sizeBytes),
        compressed: result.compressed,
        ocrProcessed: result.ocrProcessed,
      }, 201);
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to upload document', { courtId, caseNumber, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to upload document' });
    }
  });

  /**
   * Delete a document
   * DELETE /documents/:courtId/:caseNumber/:documentId
   */
  router.delete('/:courtId/:caseNumber/:documentId', async (c) => {
    const { courtId, caseNumber, documentId } = c.req.param();
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID is required' });
    }

    try {
      const storage = createDocumentStorage(
        c.env.COURT_DOCS,
        c.env.COURT_SESSIONS,
        c.env.MERIDIAN_SECRET_KEY
      );

      // Get document size before deletion for usage tracking
      const history = await storage.getVersionHistory({
        courtId,
        caseNumber,
        documentId,
      });

      const totalBytes = history.versions.reduce((sum, v) => sum + v.sizeBytes, 0);

      const success = await storage.deleteDocument({
        courtId,
        caseNumber,
        documentId,
      });

      if (!success) {
        throw new HTTPException(500, { message: 'Failed to delete document' });
      }

      // Update usage
      const usageTracker = createUsageTracker(c.env.COURT_SESSIONS);
      await usageTracker.updateUsage(userId, courtId, {
        documents: -1,
        bytes: -totalBytes,
      });

      return c.json({
        success: true,
        message: 'Document deleted',
        versionsDeleted: history.versions.length,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to delete document', { documentId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to delete document' });
    }
  });

  /**
   * Get OCR text
   * GET /documents/:courtId/:caseNumber/:documentId/ocr
   */
  router.get('/:courtId/:caseNumber/:documentId/ocr', async (c) => {
    const { courtId, caseNumber, documentId } = c.req.param();
    const version = c.req.query('version');

    try {
      const storage = createDocumentStorage(
        c.env.COURT_DOCS,
        c.env.COURT_SESSIONS,
        c.env.MERIDIAN_SECRET_KEY
      );

      const ocrText = await storage.getOcrText({
        courtId,
        caseNumber,
        documentId,
        version: version ? parseInt(version, 10) : undefined,
      });

      if (!ocrText) {
        throw new HTTPException(404, { message: 'OCR text not available' });
      }

      return c.json({
        success: true,
        documentId,
        text: ocrText,
        characterCount: ocrText.length,
      });
    } catch (error) {
      if (error instanceof HTTPException) throw error;
      logger.error('Failed to get OCR text', { documentId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get OCR text' });
    }
  });

  /**
   * Get user storage usage
   * GET /documents/usage
   */
  router.get('/usage', async (c) => {
    const userId = c.req.header('X-User-Id');

    if (!userId) {
      throw new HTTPException(401, { message: 'User ID is required' });
    }

    try {
      const usageTracker = createUsageTracker(c.env.COURT_SESSIONS);
      const usage = await usageTracker.getUsage(userId);
      const check = await usageTracker.checkCanUpload(userId, 'free', 0);

      return c.json({
        success: true,
        userId,
        usage: usage ? {
          documents: usage.documentCount,
          bytes: usage.totalBytes,
          bytesFormatted: formatBytes(usage.totalBytes),
          lastUpdated: usage.lastUpdated.toISOString(),
        } : null,
        limits: check.limits,
        percentUsed: check.percentUsed,
      });
    } catch (error) {
      logger.error('Failed to get usage', { userId, error: String(error) });
      throw new HTTPException(500, { message: 'Failed to get usage' });
    }
  });

  return router;
}
