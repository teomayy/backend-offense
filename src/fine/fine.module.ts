import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { AuthModule } from 'src/auth/auth.module'
import { EskizModule } from 'src/eskiz/eskiz.module'
import { PrismaService } from 'src/prisma.service'
import { FineController } from './fine.controller'
import { FineService } from './fine.service'

@Module({
	imports: [EskizModule, JwtModule.register({}), AuthModule],
	providers: [FineService, PrismaService],
	controllers: [FineController]
})
export class FineModule {}
