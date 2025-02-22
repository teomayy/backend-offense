import { PrismaClient } from '@prisma/client'
import { hash } from 'argon2'

const prisma = new PrismaClient()

async function main() {
	const adminExists = await prisma.admin.findFirst()
	if (!adminExists) {
		const password = await hash('admin123') // Укажите свой пароль
		await prisma.admin.create({
			data: {
				name: 'Super Admin',
				login: 'adminchik',
				password
			}
		})
		console.log('Администратор создан с логином "admin" и паролем "admin123"')
	} else {
		console.log('Администратор уже существует')
	}
}

main()
	.catch(e => console.error(e))
	.finally(() => prisma.$disconnect())
