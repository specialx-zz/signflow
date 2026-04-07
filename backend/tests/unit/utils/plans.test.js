process.env.NODE_ENV = 'test';

const { PLANS, getPlan, getAllPlans, hasFeature, calculatePrice } = require('../../../src/utils/plans');

describe('plans utility', () => {
  describe('PLANS object', () => {
    it('contains all expected plans', () => {
      expect(PLANS).toHaveProperty('starter');
      expect(PLANS).toHaveProperty('business');
      expect(PLANS).toHaveProperty('enterprise');
      expect(PLANS).toHaveProperty('custom');
    });

    it('each plan has required properties', () => {
      const requiredKeys = [
        'id', 'name', 'nameKo', 'maxDevices', 'maxStorageGB',
        'maxUsers', 'maxStores', 'features', 'monthlyPrice',
        'yearlyPrice', 'auditLogDays',
      ];

      for (const planId of Object.keys(PLANS)) {
        for (const key of requiredKeys) {
          expect(PLANS[planId]).toHaveProperty(key);
        }
      }
    });

    it('plan id matches its key', () => {
      for (const [key, plan] of Object.entries(PLANS)) {
        expect(plan.id).toBe(key);
      }
    });
  });

  describe('plan limits ordering (starter < business < enterprise)', () => {
    it('maxDevices increases with plan tier', () => {
      expect(PLANS.starter.maxDevices).toBeLessThan(PLANS.business.maxDevices);
      expect(PLANS.business.maxDevices).toBeLessThan(PLANS.enterprise.maxDevices);
    });

    it('maxStorageGB increases with plan tier', () => {
      expect(PLANS.starter.maxStorageGB).toBeLessThan(PLANS.business.maxStorageGB);
      expect(PLANS.business.maxStorageGB).toBeLessThan(PLANS.enterprise.maxStorageGB);
    });

    it('maxUsers increases with plan tier', () => {
      expect(PLANS.starter.maxUsers).toBeLessThan(PLANS.business.maxUsers);
      expect(PLANS.business.maxUsers).toBeLessThan(PLANS.enterprise.maxUsers);
    });

    it('maxStores increases with plan tier', () => {
      expect(PLANS.starter.maxStores).toBeLessThan(PLANS.business.maxStores);
      expect(PLANS.business.maxStores).toBeLessThan(PLANS.enterprise.maxStores);
    });

    it('auditLogDays increases with plan tier', () => {
      expect(PLANS.starter.auditLogDays).toBeLessThan(PLANS.business.auditLogDays);
      expect(PLANS.business.auditLogDays).toBeLessThan(PLANS.enterprise.auditLogDays);
    });

    it('monthlyPrice increases with plan tier (excluding custom)', () => {
      expect(PLANS.starter.monthlyPrice).toBeLessThan(PLANS.business.monthlyPrice);
      expect(PLANS.business.monthlyPrice).toBeLessThan(PLANS.enterprise.monthlyPrice);
    });
  });

  describe('getPlan', () => {
    it('returns the correct plan by id', () => {
      expect(getPlan('starter')).toBe(PLANS.starter);
      expect(getPlan('business')).toBe(PLANS.business);
      expect(getPlan('enterprise')).toBe(PLANS.enterprise);
      expect(getPlan('custom')).toBe(PLANS.custom);
    });

    it('falls back to starter for unknown plan id', () => {
      expect(getPlan('nonexistent')).toBe(PLANS.starter);
      expect(getPlan(undefined)).toBe(PLANS.starter);
      expect(getPlan(null)).toBe(PLANS.starter);
    });
  });

  describe('getAllPlans', () => {
    it('returns an array of all plans', () => {
      const all = getAllPlans();
      expect(Array.isArray(all)).toBe(true);
      expect(all).toHaveLength(Object.keys(PLANS).length);
    });

    it('includes every plan object', () => {
      const all = getAllPlans();
      expect(all).toContain(PLANS.starter);
      expect(all).toContain(PLANS.business);
      expect(all).toContain(PLANS.enterprise);
      expect(all).toContain(PLANS.custom);
    });
  });

  describe('hasFeature', () => {
    it('returns true for features included in a plan', () => {
      expect(hasFeature('starter', 'basic_layout')).toBe(true);
      expect(hasFeature('starter', 'email_support')).toBe(true);
      expect(hasFeature('business', 'api_access')).toBe(true);
      expect(hasFeature('enterprise', 'custom_branding')).toBe(true);
    });

    it('returns false for features not in a plan', () => {
      expect(hasFeature('starter', 'api_access')).toBe(false);
      expect(hasFeature('starter', 'custom_branding')).toBe(false);
      expect(hasFeature('business', 'custom_branding')).toBe(false);
    });

    it('custom plan has all features (via "all" wildcard)', () => {
      expect(hasFeature('custom', 'basic_layout')).toBe(true);
      expect(hasFeature('custom', 'api_access')).toBe(true);
      expect(hasFeature('custom', 'custom_branding')).toBe(true);
      expect(hasFeature('custom', 'any_random_feature')).toBe(true);
    });

    it('falls back to starter for unknown plan id', () => {
      expect(hasFeature('nonexistent', 'basic_layout')).toBe(true);
      expect(hasFeature('nonexistent', 'api_access')).toBe(false);
    });
  });

  describe('calculatePrice', () => {
    it('returns monthly price by default', () => {
      const result = calculatePrice('starter');
      expect(result.total).toBe(PLANS.starter.monthlyPrice);
      expect(result.monthly).toBe(PLANS.starter.monthlyPrice);
    });

    it('returns monthly price when billingCycle is "monthly"', () => {
      const result = calculatePrice('business', 'monthly');
      expect(result.total).toBe(PLANS.business.monthlyPrice);
      expect(result.monthly).toBe(PLANS.business.monthlyPrice);
    });

    it('returns yearly price and per-month breakdown for yearly cycle', () => {
      const result = calculatePrice('business', 'yearly');
      expect(result.total).toBe(PLANS.business.yearlyPrice);
      expect(result.monthly).toBe(Math.round(PLANS.business.yearlyPrice / 12));
    });

    it('yearly monthly is less than monthly price (discount)', () => {
      for (const planId of ['starter', 'business', 'enterprise']) {
        const monthly = calculatePrice(planId, 'monthly');
        const yearly = calculatePrice(planId, 'yearly');
        expect(yearly.monthly).toBeLessThan(monthly.monthly);
      }
    });

    it('falls back to starter for unknown plan', () => {
      const result = calculatePrice('nonexistent', 'monthly');
      expect(result.total).toBe(PLANS.starter.monthlyPrice);
    });
  });
});
