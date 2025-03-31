import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import { NestFactory } from "@nestjs/core";
import { Logger, VersioningType } from "@nestjs/common";

import { AppModule } from "@/app.module";
import { EnvService } from "@/env/env.service";
import { SwaggerDocumentBuilder } from "@/swagger/swagger-document-builder";

const globalPrefix = "api";

async function bootstrap() {
  const logger: Logger = new Logger("Main");

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.register(fastifyCookie, {
    secret: "your-secret-key", // for signed cookies
    hook: "onRequest", // set to false to disable cookie parsing on each request
    algorithm: "SHA256",
    parseOptions: {}, // options for parsing cookies
  });
  app.enableCors({
    origin: true, // Replace with your Next.js URL
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
    credentials: true, // If you need to send cookies
    allowedHeaders: "Content-Type, Authorization",
  });

  app.setGlobalPrefix(globalPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
  });

  const envService = app.get(EnvService);
  const PORT = envService.get("PORT");
  const NODE_ENV = envService.get("NODE_ENV");

  const swaggerDocumentBuilder = new SwaggerDocumentBuilder(app);
  swaggerDocumentBuilder.setupSwagger(envService);

  await app.listen(PORT);

  logger.debug(
    `\nPORT: ${PORT}\nNODE_ENV: ${NODE_ENV}\nURL: ${await app.getUrl()}\n`,
  );
}

bootstrap();
