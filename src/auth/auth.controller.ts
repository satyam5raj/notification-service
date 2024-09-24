import { Controller, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/public.decorator';
import * as Sentry from '@sentry/node';

@Controller('auth/tenant')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('generate-token')
    async generateToken(@Body('tenant_id') tenantId: number) {
        return Sentry.startSpan({ op: 'controller', name: 'Generate JWT Token' }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Generating token for tenant ID: ${tenantId}` });
                const result = await this.authService.generateToken(tenantId);
                return { status: 'success', message: 'Token generated successfully', result };
            } catch (error) {
                Sentry.captureException(error);
                throw new InternalServerErrorException('Failed to generate token');
            } finally {
                span.end();
            }
        });
    }
}
