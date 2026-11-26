import { INestApplication, ValidationPipe } from '@nestjs/common';

/**
 * App-wide HTTP settings, shared by main.ts and the HTTP tests so the tests
 * exercise the same pipeline as the real server.
 */
export function configureApp(app: INestApplication): void {
  // Frontend dev server runs on another port.
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // drop properties not declared in the DTO
      forbidNonWhitelisted: true, // ...and reject the request if any were sent
      transform: true,
    }),
  );
}
