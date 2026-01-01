import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 GO-API running on port ${port}`);
}
bootstrap();
