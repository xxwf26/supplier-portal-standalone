import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

const USERS = [
  { id: 1, username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, username: 'viewer', password: 'viewer123', role: 'viewer' },
];

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  validateUser(username: string, password: string): { id: number; username: string; role: string } | null {
    const user = USERS.find(u => u.username === username && u.password === password);
    return user ? { id: user.id, username: user.username, role: user.role } : null;
  }

  login(user: { id: number; username: string; role: string }, rememberMe = false) {
    const payload = { sub: user.id, username: user.username, role: user.role };
    const expiresIn = rememberMe ? '30d' : '8h';
    return {
      access_token: this.jwtService.sign(payload, { expiresIn }),
      user: { username: user.username, role: user.role },
      expiresIn,
    };
  }
}
