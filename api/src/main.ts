import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './shared/prisma.service';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // CORS - permitir todas as origens
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: '*',
    credentials: false,
  });
  
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Criar usuário admin se não existir
  const prisma = app.get(PrismaService);
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@goapi.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  try {
    const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existingAdmin) {
      const hash = await bcrypt.hash(adminPassword, 10);
      await prisma.user.create({
        data: { email: adminEmail, password: hash, role: 'ADMIN' },
      });
      console.log(`✅ Admin user created: ${adminEmail}`);
    } else {
      const hash = await bcrypt.hash(adminPassword, 10);
      await prisma.user.update({
        where: { email: adminEmail },
        data: { password: hash },
      });
      console.log(`✅ Admin user updated: ${adminEmail}`);
    }
  } catch (err) {
    console.log('⚠️ Could not create/update admin user:', err.message);
  }
  
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 GO-API running on port ${port}`);
}
bootstrap();
