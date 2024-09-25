import { Controller, Post, Body, InternalServerErrorException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../common/public.decorator';
import * as Sentry from '@sentry/node';

@Controller('auth/tenant')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('generate-token')
    async generateToken(@Body() body: { tenant_id: number }) {
        const { tenant_id } = body;
        return Sentry.startSpan({ op: 'controller', name: 'Generate JWT Token' }, async (span) => {
            try {
                Sentry.addBreadcrumb({ message: `Generating token for tenant ID: ${tenant_id}` });
                const result = await this.authService.generateToken(tenant_id);
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
