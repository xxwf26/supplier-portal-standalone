import { JwtService } from '@nestjs/jwt';
export declare class AuthService {
    private jwtService;
    constructor(jwtService: JwtService);
    validateUser(username: string, password: string): {
        id: number;
        username: string;
        role: string;
    } | null;
    login(user: {
        id: number;
        username: string;
        role: string;
    }, rememberMe?: boolean): {
        access_token: string;
        user: {
            username: string;
            role: string;
        };
        expiresIn: string;
    };
}
//# sourceMappingURL=auth.service.d.ts.map