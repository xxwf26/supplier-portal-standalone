import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: 'supplier-portal-secret-key-2024',
    });
  }

  async validate(payload: { sub: number; username: string; role: string }) {
    return { userId: payload.sub, username: payload.username, role: payload.role };
  }
}