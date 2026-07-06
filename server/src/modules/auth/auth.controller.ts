import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('/api/auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string; rememberMe?: boolean }) {
    const user = await this.authService.validateUser(body.username, body.password);
    if (!user) throw new UnauthorizedException('用户名或密码错误');
    return this.authService.login(user, body.rememberMe ?? false);
  }
}
