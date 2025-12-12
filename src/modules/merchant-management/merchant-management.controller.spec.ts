import { Test, TestingModule } from '@nestjs/testing';
import { MerchantManagementController } from './merchant-management.controller';

describe('MerchantManagementController', () => {
  let controller: MerchantManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantManagementController],
    }).compile();

    controller = module.get<MerchantManagementController>(
      MerchantManagementController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
