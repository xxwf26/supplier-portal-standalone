import { AuthService } from './auth.service';
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(body: {
        username: string;
        password: string;
    }): {
        access_token: string;
        user: {
            username: string;
            role: string;
        };
    };
}
//# sourceMappingURL=auth.controller.d.ts.map