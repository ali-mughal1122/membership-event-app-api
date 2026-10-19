import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Enable global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true, // strip out unexpected fields
  }));

  app.use((req, res, next) => {
    // Structured minimal request logger (avoid leaking bearer tokens)
    if (process.env.NODE_ENV !== 'production') {
      const hasAuth = !!req.headers['authorization'];
      console.log(`[REQUEST] ${req.method} ${req.originalUrl} (authenticated: ${hasAuth})`);
    }
    next();
  });

  // Configure Swagger
  const config = new DocumentBuilder()
    .setTitle('Membership Event API')
    .setDescription('The API description for the Membership Event App')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
