import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.enableCors({
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend rodando em http://localhost:${port}/api/v1`);
  console.log(`   APIFY_API_TOKEN:    ${process.env.APIFY_API_TOKEN ? '✅ configurado' : '❌ NÃO configurado'}`);
  console.log(`   EVOLUTION_API_URL:  ${process.env.EVOLUTION_API_URL ? '✅ ' + process.env.EVOLUTION_API_URL : '❌ NÃO configurado'}`);
  console.log(`   EVOLUTION_API_KEY:  ${process.env.EVOLUTION_API_KEY ? '✅ configurado' : '❌ NÃO configurado'}`);
  console.log(`   OPENAI_API_KEY:     ${process.env.OPENAI_API_KEY ? '✅ configurado' : '❌ NÃO configurado'}`);
}
bootstrap();
