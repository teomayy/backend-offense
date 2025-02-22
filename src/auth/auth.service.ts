import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager'
import {
	Inject,
	Injectable,
	Logger,
	NotFoundException,
	UnauthorizedException
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { verify } from 'argon2'

import { Response } from 'express'
import { AdminService } from 'src/admin/admin.service'
import { EskizService } from 'src/eskiz/eskiz.service'
import { InspectorService } from 'src/inspector/inspector.service'
import { AuthDto } from './dto/auth.dto'

@Injectable()
export class AuthService {
	EXPIRE_DAY_REFRESH_TOKEN = 7
	REFRESH_TOKEN_NAME = 'refreshToken'

	private readonly logger = new Logger(AuthService.name)

	constructor(
		@Inject(CACHE_MANAGER)
		private cacheManager: Cache,
		private inspectorService: InspectorService,
		private adminService: AdminService,
		private jwtService: JwtService,
		private eskizService: EskizService,
		private readonly configService: ConfigService
	) {}

	private readonly MAX_ATTEMPTS = 5
	private readonly LOCK_TIME = 15 * 60 * 1000

	async login(dto: AuthDto) {
		// 🔹 1. Проверяем число неудачных попыток входа
		const failedAttempts =
			((await this.cacheManager.get(
				`failedAttempts:${dto.login}`
			)) as number) || 0
		if (failedAttempts >= this.MAX_ATTEMPTS) {
			throw new UnauthorizedException(
				'Превышено число попыток. Попробуйте позже.'
			)
		}

		// 🔹 2. Проверяем логин и пароль
		try {
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			const { password, ...user } = await this.validateUser(dto)

			// 🔹 3. Сбрасываем счетчик неудачных попыток, если вход успешен
			await this.cacheManager.del(`failedAttempts:${dto.login}`)

			// 🔹 4. Генерируем токены
			const tokens = this.issueTokens(user.id, user.role)

			// 🔹 5. Сохраняем refreshToken
			if (user.role === 'inspector') {
				await this.inspectorService.saveRefreshToken(
					user.id,
					tokens.refreshToken
				)
			} else if (user.role === 'admin') {
				await this.adminService.saveRefreshToken(user.id, tokens.refreshToken)
			}

			return { user, ...tokens }
		} catch (error) {
			await this.handleFailedLogin(dto.login)
			throw error
		}
	}

	async handleFailedLogin(login: string) {
		const failedAttempts =
			(((await this.cacheManager.get(`failedAttempts:${login}`)) as number) ||
				0) + 1

		const newAttempts = failedAttempts + 1
		await this.cacheManager.set(
			`failedAttempts:${login}`,
			newAttempts,
			this.LOCK_TIME / 1000
		)

		if (failedAttempts >= this.MAX_ATTEMPTS) {
			throw new UnauthorizedException('Ваш аккаунт заблокирован на 15 минут.')
		}
	}

	/**
	 * Обновление токенов
	 */
	async getNewTokens(refreshToken: string) {
		const result = await this.jwtService.verifyAsync(refreshToken)
		if (!result) throw new UnauthorizedException('Invalid refresh token')

		let user

		if (result.role === 'inspector') {
			user = await this.inspectorService.getById(result.id)
		} else if (result.role === 'admin') {
			user = await this.adminService.getById(result.id)
		} else {
			throw new UnauthorizedException('Роль пользователя не распознана')
		}

		if (!user || user.refreshToken !== refreshToken) {
			throw new UnauthorizedException('Refresh token не валиден')
		}

		const tokens = this.issueTokens(user.id, result.role)
		if (result.role === 'admin') {
			await this.adminService.saveRefreshToken(user.id, tokens.refreshToken)
		} else if (result.role === 'inspector') {
			await this.inspectorService.saveRefreshToken(user.id, tokens.refreshToken)
		}

		return { user, ...tokens }
	}

	/**
	 * Генерация токенов
	 */
	private issueTokens(userId: string, role: string) {
		const data = { id: userId, role }

		const accessToken = this.jwtService.sign(data, {
			expiresIn: '1h'
		})

		const refreshToken = this.jwtService.sign(data, {
			expiresIn: '7d'
		})

		return { accessToken, refreshToken }
	}

	private async validateUser(dto: AuthDto) {
		let user = null
		let role = ''

		const inspector = await this.inspectorService.getByLogin(dto.login)
		if (inspector) {
			const isValid = await verify(inspector.password, dto.password)
			if (isValid) {
				user = inspector
				role = 'inspector'
			}
		}

		if (!user) {
			const admin = await this.adminService.getByLogin(dto.login)
			if (admin) {
				const isValid = await verify(admin.password, dto.password)
				if (isValid) {
					user = admin
					role = 'admin'
				}
			}
		}
		if (!user) throw new NotFoundException('Пользователь не найден!')
		if (!role) throw new UnauthorizedException('Пароль неверный!')

		return { ...user, role }
	}

	/**
	 * Добавление refreshToken в cookies
	 */
	addRefreshTokenToResponse(res: Response, refreshToken: string) {
		const expiresIn = new Date()
		expiresIn.setDate(expiresIn.getDate() + this.EXPIRE_DAY_REFRESH_TOKEN)

		const domain = this.configService.get<string>('DOMAIN')
		res.cookie(this.REFRESH_TOKEN_NAME, refreshToken, {
			httpOnly: true,
			domain: domain,
			expires: expiresIn,
			secure: true,
			sameSite: 'none'
		})
	}

	/**
	 * Удаление токенов из cookies
	 */
	removeRefreshTokenResponse(res: Response) {
		const domain = this.configService.get<string>('DOMAIN')

		res.cookie(this.REFRESH_TOKEN_NAME, '', {
			httpOnly: true,
			domain: domain,
			expires: new Date(0),
			secure: true,
			sameSite: 'none'
		})

		res.cookie('accessToken', '', {
			httpOnly: true,
			domain: domain,
			expires: new Date(0),
			secure: true,
			sameSite: 'none'
		})
	}

	async forceLogout(userId: string, role: string) {
		let user = null

		if (role === 'admin') {
			user = await this.adminService.getById(userId)
		} else if (role === 'inspector') {
			user = await this.inspectorService.getById(userId)
		} else {
			throw new UnauthorizedException('Роль пользователя не распознана')
		}

		if (!user) throw new NotFoundException('Пользователь не найден')

		if (role === 'admin') {
			await this.adminService.clearRefreshToken(userId)
		} else {
			await this.inspectorService.clearRefreshToken(userId)
		}
	}
}
