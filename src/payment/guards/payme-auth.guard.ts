import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PaymeError } from 'src/constants/payme.constants'

@Injectable()
export class PaymeAuthGuard implements CanActivate {
	constructor(private readonly configService: ConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest()
		const authHeader = request.headers.authorization

		if (!authHeader) {
			request.res.status(200).json({
				jsonrpc: '2.0',
				error: PaymeError.InvalidAuthorization,
				id: null
			})
			return false
		}

		const decodedAuth = Buffer.from(
			authHeader.split(' ')[1] || '',
			'base64'
		).toString()

		// const [username, password] = decodedAuth.split(':')

		// console.log('username', username)
		// console.log('password', password)

		const PAYME_USERNAME = 'Paycom'
		const PAYME_MERCHANT_KEY = this.configService.get<string>(
			'PAYME_SECRET_KEY_TEST'
		)

		if (decodedAuth !== `${PAYME_USERNAME}:${PAYME_MERCHANT_KEY}`) {
			request.res.status(200).json({
				jsonrpc: '2.0',
				error: PaymeError.InvalidAuthorization,
				id: null
			})
			return false
		}

		return true
	}
}
