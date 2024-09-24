import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as jwt from 'jsonwebtoken';
import * as Sentry from '@sentry/node';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DatabaseService,
  ) { }

  async generateToken(tenantId: number): Promise<{ access_token: string }> {
    return Sentry.startSpan({ op: 'service', name: 'Generate JWT Token' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: `Checking if tenant ID ${tenantId} exists` });

        const tenant = await this.db.queryBuilder()
          .selectFrom('tenants')
          .select(['id', 'tenant_name'])
          .where('id', '=', tenantId)
          .executeTakeFirst();

        if (!tenant) {
          Sentry.captureMessage(`Tenant with ID ${tenantId} not found`);
          throw new NotFoundException(`Tenant with id ${tenantId} not found`);
        }

        const payload = { tenant_id: tenantId };
        const accessToken = this.jwtService.sign(payload);

        Sentry.addBreadcrumb({ message: `Token generated successfully for tenant ID ${tenantId}` });
        return { access_token: accessToken };
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to generate token');
      } finally {
        span.end();
      }
    });
  }

  async decodeToken(token: string) {
    return Sentry.startSpan({ op: 'service', name: 'Decode JWT Token' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: 'Decoding token' });
        const decoded = await jwt.decode(token) as jwt.JwtPayload;
        return decoded;
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to decode token');
      } finally {
        span.end();
      }
    });
  }
}
