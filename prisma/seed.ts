import { PrismaClient } from '@prisma/client'
import { hash } from 'argon2'

const prisma = new PrismaClient()

async function main() {
  const adminPassword = await hash('admin123')

  await prisma.admin.upsert({
    where: { login: 'admin' },
    update: {},
    create: {
      name: 'Administrator',
      login: 'admin',
      password: adminPassword,
      role: 'admin',
    },
  })

  console.log('Seed completed: Admin user created')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
