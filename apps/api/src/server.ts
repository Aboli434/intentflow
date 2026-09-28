import { buildApp } from './app.js';
import { env, validateProductionEnvStatus } from './config/env.js';
import { ensurePhase16Schema } from './config/database.js';

const app = buildApp();

const start = async () => {
  try {
    validateProductionEnvStatus();
    await ensurePhase16Schema();
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 IntentFlow API running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
