import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const port = process.env.PORT ?? 4006;
  await app.listen(port);
  console.log(`homeappliances-sales-agent running on port ${port}`);
}
bootstrap();
