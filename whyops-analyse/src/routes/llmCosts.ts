import { Hono } from 'hono';
import { LlmCostController } from '../controllers/llmCost.controller';

const llmCostsRouter = new Hono();

llmCostsRouter.post('/', LlmCostController.getCosts);

export default llmCostsRouter;
