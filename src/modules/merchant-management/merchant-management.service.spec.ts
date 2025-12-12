import { Test, TestingModule } from '@nestjs/testing';
import { MerchantManagementService } from './merchant-management.service';

describe('MerchantManagementService', () => {
  let service: MerchantManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantManagementService],
    }).compile();

    service = module.get<MerchantManagementService>(MerchantManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
