import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import * as jwt from 'jsonwebtoken';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';

const mockJwtService = {
    sign: jest.fn(),
};

const mockDatabaseService = {
    queryBuilder: jest.fn().mockReturnThis(),
    selectFrom: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    executeTakeFirst: jest.fn(),
};

describe('AuthService', () => {
    let authService: AuthService;
    let jwtService: JwtService;
    let db: DatabaseService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: JwtService, useValue: mockJwtService },
                { provide: DatabaseService, useValue: mockDatabaseService },
            ],
        }).compile();

        authService = module.get<AuthService>(AuthService);
        jwtService = module.get<JwtService>(JwtService);
        db = module.get<DatabaseService>(DatabaseService);
    });

    describe('generateToken', () => {
        it('should generate a token for a valid tenant ID', async () => {
            const tenantId = 1;
            const mockTenant = { id: tenantId, tenant_name: 'Test Tenant' };
            const accessToken = 'mockAccessToken';

            mockDatabaseService.executeTakeFirst.mockResolvedValue(mockTenant);
            mockJwtService.sign.mockReturnValue(accessToken);

            const result = await authService.generateToken(tenantId);

            expect(result).toEqual({ access_token: accessToken });
            expect(mockDatabaseService.queryBuilder).toHaveBeenCalled();
            expect(mockJwtService.sign).toHaveBeenCalledWith({ tenant_id: tenantId });
        });

        it('should throw a NotFoundException if tenant does not exist', async () => {
            const tenantId = 1;
            mockDatabaseService.executeTakeFirst.mockResolvedValue(null);

            await expect(authService.generateToken(tenantId)).rejects.toThrow(NotFoundException);
        });

        it('should throw an InternalServerErrorException on error', async () => {
            const tenantId = 1;
            mockDatabaseService.executeTakeFirst.mockRejectedValue(new Error('DB error'));

            await expect(authService.generateToken(tenantId)).rejects.toThrow(InternalServerErrorException);
        });
    });

    describe('decodeToken', () => {
        it('should decode a token successfully', async () => {
            const token = 'mockToken';
            const mockDecoded = { tenant_id: 1 };

            jest.spyOn(jwt, 'decode').mockReturnValue(mockDecoded);

            const result = await authService.decodeToken(token);

            expect(result).toEqual(mockDecoded);
            expect(jwt.decode).toHaveBeenCalledWith(token);
        });

        it('should throw an InternalServerErrorException on error', async () => {
            const token = 'mockToken';
            jest.spyOn(jwt, 'decode').mockImplementation(() => { throw new Error('Decode error'); });

            await expect(authService.decodeToken(token)).rejects.toThrow(InternalServerErrorException);
        });
    });
});
