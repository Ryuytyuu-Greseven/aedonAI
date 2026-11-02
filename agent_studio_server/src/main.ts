import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  // Manual lead uploads post whole sheets as JSON; the 100kb default is too small.
  app.useBodyParser('json', { limit: '20mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    // origin: config.get<string>('CORS_ORIGIN', 'http://localhost:4200'),
    origin: '*',
    credentials: true,
  });

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
void bootstrap();
