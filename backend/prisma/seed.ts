import { PrismaClient, PluginType, CameraStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'demo@cambridge.dev';
  const passwordHash = await bcrypt.hash('demo1234', 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash },
  });

  await prisma.camera.upsert({
    where: { id: 'seed-mock-camera-0001' },
    update: {},
    create: {
      id: 'seed-mock-camera-0001',
      ownerId: user.id,
      name: 'Front Door (Mock)',
      pluginType: PluginType.MOCK,
      connectionConfig: { simulateIntervalMs: 5000 },
      status: CameraStatus.UNKNOWN,
    },
  });

  console.log('Seed complete.');
  console.log(`Demo login -> email: ${email}  password: demo1234`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
