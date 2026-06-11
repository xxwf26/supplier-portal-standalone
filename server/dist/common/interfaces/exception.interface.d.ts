import { HttpStatus } from '@nestjs/common';
import { ResponseCode } from '../constants/api_response_code';
export declare class BusinessException extends Error {
    readonly code: ResponseCode;
    readonly message: string;
    readonly httpStatus: HttpStatus;
    readonly details?: string | undefined;
    readonly fieldErrors?: Record<string, string[]> | undefined;
    constructor(code: ResponseCode, message: string, httpStatus?: HttpStatus, details?: string | undefined, fieldErrors?: Record<string, string[]> | undefined);
    getHttpStatus(): HttpStatus;
}
//# sourceMappingURL=exception.interface.d.ts.map