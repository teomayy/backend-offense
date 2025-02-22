import { HttpModule } from '@nestjs/axios'
import { CacheModule } from '@nestjs/cache-manager'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AdminService } from 'src/admin/admin.service'
import { getJwtConfig } from 'src/config/jwt.config'
import { EskizService } from 'src/eskiz/eskiz.service'
import { InspectorService } from 'src/inspector/inspector.service'
import { PrismaService } from 'src/prisma.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { RolesGuard } from './guards/roles.guards'
import { JwtStrategy } from './jwt.strategy'

@Module({
	imports: [
		PassportModule.register({ defaultStrategy: 'jwt' }),
		HttpModule,
		CacheModule.register({
			ttl: 900,
			isGlobal: true
		}),
		JwtModule.registerAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: getJwtConfig
		})
	],
	providers: [
		AuthService,
		PrismaService,
		ConfigService,
		InspectorService,
		AdminService,
		EskizService,
		JwtStrategy,
		RolesGuard
	],
	controllers: [AuthController],
	exports: [AuthService, JwtStrategy, RolesGuard, JwtModule]
})
export class AuthModule {}
