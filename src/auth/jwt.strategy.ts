import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    return Sentry.startSpan({ op: 'strategy', name: 'JWT Validation' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: `Validating token for tenant ID: ${payload.tenant_id}` });
        return { tenantId: payload.tenant_id };
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to validate token');
      } finally {
        span.end();
      }
    });
  }
}
