import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { FineModule } from 'src/fine/fine.module'
import { PrismaService } from 'src/prisma.service'
import { PaymentController } from './payment.controller'
import { PaymeService } from './payment.service'

@Module({
	imports: [ConfigModule, FineModule],
	providers: [PaymeService, PrismaService],
	controllers: [PaymentController]
})
export class PaymentModule {}
