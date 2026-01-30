import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import * as cookieParser from 'cookie-parser'
import { AppModule } from './app.module'

async function bootstrap() {
	const app = await NestFactory.create(AppModule)

	app.useGlobalPipes(new ValidationPipe())
	app.setGlobalPrefix('api')
	app.use(cookieParser())
	app.enableCors({
		origin: ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:8083', 'https://mses-jarima.uz', 'https://www.mses-jarima.uz'],
		credentials: true,
		exposedHeaders: 'set_cookie',
		allowedHeaders: ['Content-Type', 'Authorization', 'cf-ray']
	})
	await app.listen(process.env.PORT || 5000)
}
bootstrap()
