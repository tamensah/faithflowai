export class AppError extends Error {
	constructor(
		public code: string,
		message: string,
		public status: number = 400
	) {
		super(message);
		this.name = 'AppError';
	}
}

export const errorCodes = {
	INVALID_INPUT: 'INVALID_INPUT',
	NOT_FOUND: 'NOT_FOUND',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;