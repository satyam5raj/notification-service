import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { InternalServerErrorException } from '@nestjs/common';

const mockAuthService = {
  generateToken: jest.fn(),
};

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  describe('generateToken', () => {
    it('should return a success message with generated token', async () => {
      const tenantId = 1;
      const accessToken = 'mockAccessToken';
      mockAuthService.generateToken.mockResolvedValue({ access_token: accessToken });

      const result = await authController.generateToken({ tenant_id: tenantId });

      expect(result).toEqual({
        status: 'success',
        message: 'Token generated successfully',
        result: { access_token: accessToken },
      });
    });

    it('should throw an InternalServerErrorException on error', async () => {
      const tenantId = 1;
      mockAuthService.generateToken.mockRejectedValue(new Error('Service error'));

      await expect(authController.generateToken({ tenant_id: tenantId })).rejects.toThrow(InternalServerErrorException);
    });
  });
});
