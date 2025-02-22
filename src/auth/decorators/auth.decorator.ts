import { UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../guards/jwt.guards'

export const Auth = () => UseGuards(JwtAuthGuard)
