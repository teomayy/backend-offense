export enum PaymeMethod {
	CheckPerformTransaction = 'CheckPerformTransaction',
	CheckTransaction = 'CheckTransaction',
	CreateTransaction = 'CreateTransaction',
	PerformTransaction = 'PerformTransaction',
	CancelTransaction = 'CancelTransaction',
	GetStatement = 'GetStatement'
}

export interface PaymeErrorType {
	name: string
	code: number
	message: {
		uz: string
		ru: string
		en: string
	}
}

export const PaymeError = {
	InvalidAmount: {
		name: 'InvalidAmount',
		code: -31001,
		message: {
			uz: "Noto'g'ri summa",
			ru: 'Недопустимая сумма',
			en: 'Invalid amount'
		}
	} as PaymeErrorType,

	UserNotFound: {
		name: 'UserNotFound',
		code: -31050,
		message: {
			uz: 'Biz sizning hisobingizni topolmadik.',
			ru: 'Мы не нашли вашу учетную запись',
			en: "We couldn't find your account"
		}
	} as PaymeErrorType,

	ProductNotFound: {
		name: 'ProductNotFound',
		code: -31050,
		message: {
			uz: 'Biz jarimani topolmadik.',
			ru: 'Нам не удалось найти штраф.',
			en: 'We could not find the fine.'
		}
	} as PaymeErrorType,

	CantDoOperation: {
		name: 'CantDoOperation',
		code: -31008,
		message: {
			uz: 'Biz operatsiyani bajara olmaymiz',
			ru: 'Мы не можем сделать операцию',
			en: "We can't do operation"
		}
	} as PaymeErrorType,

	TransactionNotFound: {
		name: 'TransactionNotFound',
		code: -31003,
		message: {
			uz: 'Tranzaktsiya topilmadi',
			ru: 'Транзакция не найдена',
			en: 'Transaction not found'
		}
	} as PaymeErrorType,

	AlreadyDone: {
		name: 'AlreadyDone',
		code: -31060,
		message: {
			uz: "Jarima uchun to'lov qilingan",
			ru: 'Штраф оплачен',
			en: 'The fine has been paid.'
		}
	} as PaymeErrorType,

	Pending: {
		name: 'Pending',
		code: -31050,
		message: {
			uz: "Jarima uchun to'lov kutilayapti",
			ru: 'Ожидается оплата за штраф',
			en: 'Payment of fine in pending'
		}
	} as PaymeErrorType,

	InvalidAuthorization: {
		name: 'InvalidAuthorization',
		code: -32504,
		message: {
			uz: 'Avtorizatsiya yaroqsiz',
			ru: 'Авторизация недействительна',
			en: 'Authorization invalid'
		}
	} as PaymeErrorType
}

export enum PaymeData {
	orderId = 'order_id'
}

export enum TransactionState {
	Paid = 2,
	Pending = 1,
	PendingCanceled = -1,
	PaidCanceled = -2
}
