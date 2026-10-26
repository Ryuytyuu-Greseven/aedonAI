import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const port = process.env.PORT ?? 4005;
  await app.listen(port);
  console.log(`lobster-agent (Madhu) running on port ${port}`);
}
bootstrap();
