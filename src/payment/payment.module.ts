import { Module } from '@nestjs/common'
import { PrismaService } from 'src/prisma.service'
import { PaymentController } from './payment.controller'
import { PaymentService } from './payment.service'

@Module({
	providers: [PaymentService, PrismaService],
	controllers: [PaymentController]
})
export class PaymentModule {}
