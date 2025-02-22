import {
	CanActivate,
	ExecutionContext,
	ForbiddenException,
	Injectable
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { RequestWithUser } from '../types/request.with.user'

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const requiredRoles = this.reflector.get<string[]>(
			'roles',
			context.getHandler()
		)
		if (!requiredRoles) return true // Если у метода нет ограничения по ролям, доступ разрешен

		const request = context.switchToHttp().getRequest<RequestWithUser>()
		const user = request.user

		if (!user || !requiredRoles.some(role => role === user.role)) {
			throw new ForbiddenException(
				'У вас нет прав для выполнения этого действия'
			)
		}

		return true
	}
}
