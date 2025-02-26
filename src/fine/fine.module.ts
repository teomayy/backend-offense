import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { AuthModule } from 'src/auth/auth.module'
import { EskizModule } from 'src/eskiz/eskiz.module'
import { PaymeService } from 'src/payment/payment.service'
import { PrismaService } from 'src/prisma.service'
import { FineController } from './fine.controller'
import { FineService } from './fine.service'

@Module({
	imports: [EskizModule, JwtModule.register({}), AuthModule, ConfigModule],
	providers: [FineService, PrismaService, PaymeService],
	controllers: [FineController]
})
export class FineModule {}
