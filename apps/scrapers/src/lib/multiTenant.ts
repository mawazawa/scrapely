/**
 * Multi-Tenant Support
 * Tenant isolation, configuration, and management
 */

import { logger } from './logger';

/**
 * Tenant configuration
 */
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'trial' | 'churned';
  plan: TenantPlan;
  createdAt: Date;
  settings: TenantSettings;
  limits: TenantLimits;
  metadata: Record<string, unknown>;
}

/**
 * Tenant plan types
 */
export type TenantPlan = 'free' | 'starter' | 'pro' | 'enterprise' | 'custom';

/**
 * Tenant-specific settings
 */
export interface TenantSettings {
  // Branding
  displayName: string;
  logoUrl?: string;
  primaryColor?: string;
  customDomain?: string;

  // Features
  enabledFeatures: string[];
  disabledFeatures: string[];

  // Content
  defaultCategories: string[];
  defaultRegions: string[];
  customSources: number[];  // Additional source IDs

  // Notifications
  alertConfig: {
    enabled: boolean;
    channels: string[];
    quietHours?: { start: number; end: number };
  };

  // AI
  aiModelPreference: 'fast' | 'balanced' | 'quality';
  customPrompts?: Record<string, string>;
}

/**
 * Tenant usage limits
 */
export interface TenantLimits {
  maxUsers: number;
  maxSources: number;
  maxArticlesPerDay: number;
  maxReportsPerMonth: number;
  maxApiRequestsPerMinute: number;
  maxStorageBytes: number;
  retentionDays: number;
}

/**
 * Default limits by plan
 */
export const PLAN_LIMITS: Record<TenantPlan, TenantLimits> = {
  free: {
    maxUsers: 1,
    maxSources: 10,
    maxArticlesPerDay: 100,
    maxReportsPerMonth: 5,
    maxApiRequestsPerMinute: 10,
    maxStorageBytes: 100 * 1024 * 1024,  // 100MB
    retentionDays: 30,
  },
  starter: {
    maxUsers: 5,
    maxSources: 50,
    maxArticlesPerDay: 500,
    maxReportsPerMonth: 30,
    maxApiRequestsPerMinute: 30,
    maxStorageBytes: 1024 * 1024 * 1024,  // 1GB
    retentionDays: 90,
  },
  pro: {
    maxUsers: 25,
    maxSources: 200,
    maxArticlesPerDay: 2000,
    maxReportsPerMonth: 100,
    maxApiRequestsPerMinute: 100,
    maxStorageBytes: 10 * 1024 * 1024 * 1024,  // 10GB
    retentionDays: 365,
  },
  enterprise: {
    maxUsers: -1,  // Unlimited
    maxSources: -1,
    maxArticlesPerDay: -1,
    maxReportsPerMonth: -1,
    maxApiRequestsPerMinute: 1000,
    maxStorageBytes: 100 * 1024 * 1024 * 1024,  // 100GB
    retentionDays: -1,  // Unlimited
  },
  custom: {
    maxUsers: -1,
    maxSources: -1,
    maxArticlesPerDay: -1,
    maxReportsPerMonth: -1,
    maxApiRequestsPerMinute: -1,
    maxStorageBytes: -1,
    retentionDays: -1,
  },
};

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: TenantSettings = {
  displayName: '',
  enabledFeatures: ['search', 'reports', 'alerts'],
  disabledFeatures: [],
  defaultCategories: [],
  defaultRegions: [],
  customSources: [],
  alertConfig: {
    enabled: true,
    channels: ['email'],
  },
  aiModelPreference: 'balanced',
};

/**
 * Tenant context for request handling
 */
export interface TenantContext {
  tenantId: string;
  tenant: Tenant;
  userId?: string;
  userRole?: string;
}

/**
 * Tenant manager
 */
export class TenantManager {
  private kv: KVNamespace | undefined;
  private cache: Map<string, { tenant: Tenant; expiresAt: number }> = new Map();
  private cacheTtlMs: number = 5 * 60 * 1000;  // 5 minutes

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    // Check cache
    const cached = this.cache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    if (!this.kv) return null;

    const tenant = await this.kv.get<Tenant>(`tenant:${tenantId}`, 'json');

    if (tenant) {
      this.cache.set(tenantId, {
        tenant,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
    }

    return tenant;
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    if (!this.kv) return null;

    const tenantId = await this.kv.get(`tenant_slug:${slug}`);
    if (!tenantId) return null;

    return this.getTenant(tenantId);
  }

  /**
   * Get tenant by custom domain
   */
  async getTenantByDomain(domain: string): Promise<Tenant | null> {
    if (!this.kv) return null;

    const tenantId = await this.kv.get(`tenant_domain:${domain}`);
    if (!tenantId) return null;

    return this.getTenant(tenantId);
  }

  /**
   * Create new tenant
   */
  async createTenant(
    name: string,
    plan: TenantPlan = 'free',
    settings: Partial<TenantSettings> = {}
  ): Promise<Tenant> {
    const id = crypto.randomUUID();
    const slug = this.generateSlug(name);

    const tenant: Tenant = {
      id,
      name,
      slug,
      status: plan === 'free' ? 'trial' : 'active',
      plan,
      createdAt: new Date(),
      settings: { ...DEFAULT_SETTINGS, displayName: name, ...settings },
      limits: PLAN_LIMITS[plan],
      metadata: {},
    };

    if (this.kv) {
      await this.kv.put(`tenant:${id}`, JSON.stringify(tenant));
      await this.kv.put(`tenant_slug:${slug}`, id);

      if (settings.customDomain) {
        await this.kv.put(`tenant_domain:${settings.customDomain}`, id);
      }
    }

    logger.info('Tenant created', { tenantId: id, name, plan });

    return tenant;
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId: string, updates: Partial<Tenant>): Promise<Tenant | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return null;

    const updated: Tenant = {
      ...tenant,
      ...updates,
      id: tenant.id,  // Prevent ID change
      createdAt: tenant.createdAt,  // Prevent creation date change
    };

    if (this.kv) {
      await this.kv.put(`tenant:${tenantId}`, JSON.stringify(updated));

      // Update domain mapping if changed
      if (updates.settings?.customDomain !== tenant.settings.customDomain) {
        if (tenant.settings.customDomain) {
          await this.kv.delete(`tenant_domain:${tenant.settings.customDomain}`);
        }
        if (updates.settings?.customDomain) {
          await this.kv.put(`tenant_domain:${updates.settings.customDomain}`, tenantId);
        }
      }
    }

    // Invalidate cache
    this.cache.delete(tenantId);

    logger.info('Tenant updated', { tenantId, updates: Object.keys(updates) });

    return updated;
  }

  /**
   * Change tenant plan
   */
  async changePlan(tenantId: string, newPlan: TenantPlan): Promise<Tenant | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return null;

    const updated = await this.updateTenant(tenantId, {
      plan: newPlan,
      limits: PLAN_LIMITS[newPlan],
      status: newPlan === 'free' ? 'trial' : 'active',
    });

    logger.info('Tenant plan changed', {
      tenantId,
      oldPlan: tenant.plan,
      newPlan,
    });

    return updated;
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId: string, reason: string): Promise<boolean> {
    const updated = await this.updateTenant(tenantId, {
      status: 'suspended',
      metadata: { suspendReason: reason, suspendedAt: new Date().toISOString() },
    });

    return updated !== null;
  }

  /**
   * Reactivate tenant
   */
  async reactivateTenant(tenantId: string): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return false;

    const updated = await this.updateTenant(tenantId, {
      status: 'active',
      metadata: {
        ...tenant.metadata,
        reactivatedAt: new Date().toISOString(),
      },
    });

    return updated !== null;
  }

  /**
   * Check if tenant has reached a limit
   */
  async checkLimit(
    tenantId: string,
    limitType: keyof TenantLimits,
    currentValue: number
  ): Promise<{ allowed: boolean; limit: number; current: number; remaining: number }> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) {
      return { allowed: false, limit: 0, current: currentValue, remaining: 0 };
    }

    const limit = tenant.limits[limitType];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, current: currentValue, remaining: -1 };
    }

    const allowed = currentValue < limit;
    const remaining = Math.max(0, limit - currentValue);

    return { allowed, limit, current: currentValue, remaining };
  }

  /**
   * Check if feature is enabled for tenant
   */
  async isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant || tenant.status !== 'active') {
      return false;
    }

    if (tenant.settings.disabledFeatures.includes(feature)) {
      return false;
    }

    if (tenant.settings.enabledFeatures.length > 0) {
      return tenant.settings.enabledFeatures.includes(feature);
    }

    return true;
  }

  /**
   * Get tenant usage statistics
   */
  async getUsageStats(tenantId: string): Promise<{
    users: number;
    sources: number;
    articlesToday: number;
    reportsThisMonth: number;
    storageUsed: number;
  } | null> {
    const tenant = await this.getTenant(tenantId);
    if (!tenant) return null;

    // In production, query actual usage from database
    return {
      users: 0,
      sources: 0,
      articlesToday: 0,
      reportsThisMonth: 0,
      storageUsed: 0,
    };
  }

  /**
   * List all tenants
   */
  async listTenants(options: {
    status?: Tenant['status'];
    plan?: TenantPlan;
    limit?: number;
    cursor?: string;
  } = {}): Promise<{ tenants: Tenant[]; cursor?: string }> {
    if (!this.kv) return { tenants: [] };

    const tenants: Tenant[] = [];
    const listed = await this.kv.list({
      prefix: 'tenant:',
      limit: options.limit || 100,
      cursor: options.cursor,
    });

    for (const key of listed.keys) {
      const tenant = await this.kv.get<Tenant>(key.name, 'json');
      if (!tenant) continue;

      // Apply filters
      if (options.status && tenant.status !== options.status) continue;
      if (options.plan && tenant.plan !== options.plan) continue;

      tenants.push(tenant);
    }

    return {
      tenants,
      cursor: listed.list_complete ? undefined : listed.cursor,
    };
  }

  /**
   * Generate URL-safe slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}

/**
 * Middleware to extract tenant context from request
 */
export async function extractTenantContext(
  request: Request,
  manager: TenantManager
): Promise<TenantContext | null> {
  // Try custom domain first
  const host = request.headers.get('Host');
  if (host) {
    const tenant = await manager.getTenantByDomain(host);
    if (tenant) {
      return { tenantId: tenant.id, tenant };
    }
  }

  // Try X-Tenant-ID header
  const tenantIdHeader = request.headers.get('X-Tenant-ID');
  if (tenantIdHeader) {
    const tenant = await manager.getTenant(tenantIdHeader);
    if (tenant) {
      return { tenantId: tenant.id, tenant };
    }
  }

  // Try subdomain extraction (e.g., acme.meridian.xyz)
  if (host) {
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
      const tenant = await manager.getTenantBySlug(subdomain);
      if (tenant) {
        return { tenantId: tenant.id, tenant };
      }
    }
  }

  return null;
}

/**
 * Create tenant manager instance
 */
export function createTenantManager(kv?: KVNamespace): TenantManager {
  return new TenantManager(kv);
}
