import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = buildApp();

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`🚀 IntentFlow API running on http://${env.HOST}:${env.PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
