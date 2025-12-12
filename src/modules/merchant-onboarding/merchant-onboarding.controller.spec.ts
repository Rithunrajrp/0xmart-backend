import { Test, TestingModule } from '@nestjs/testing';
import { MerchantOnboardingController } from './merchant-onboarding.controller';

describe('MerchantOnboardingController', () => {
  let controller: MerchantOnboardingController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantOnboardingController],
    }).compile();

    controller = module.get<MerchantOnboardingController>(
      MerchantOnboardingController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
