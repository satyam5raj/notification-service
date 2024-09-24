import { Injectable, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, Observable } from 'rxjs';
import * as Sentry from '@sentry/node';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const canActivate = super.canActivate(context);

    return Sentry.startSpan({ op: 'guard', name: 'JWT Auth Guard' }, async (span) => {
      try {
        Sentry.addBreadcrumb({ message: 'Executing auth guard' });

        // Ensure it's either a boolean or Promise<boolean> by converting Observable
        if (canActivate instanceof Observable) {
          return await firstValueFrom(canActivate);
        }

        return canActivate;
      } catch (error) {
        Sentry.captureException(error);
        throw new InternalServerErrorException('Failed to authorize request');
      } finally {
        span.end();
      }
    });
  }
}
