import { createServiceLogger } from '@whyops/shared/logger';
import { Context } from 'hono';
import { llmCostService } from '@whyops/shared/services';

const logger = createServiceLogger('analyse:llm-cost-controller');

export class LlmCostController {
  static async getCosts(c: Context) {
    try {
      const data = await c.req.json();
      const { models } = data;

      if (!models) {
         return c.json({ error: 'Missing models parameter' }, 400);
      }

      const result = await llmCostService.getCosts(models);
      return c.json(result);
    } catch (error: any) {
      logger.error({ error }, 'Failed to fetch llm costs');
      return c.json({ error: 'Failed to fetch llm costs' }, 500);
    }
  }
}
