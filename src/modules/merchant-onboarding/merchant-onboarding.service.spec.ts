import { Test, TestingModule } from '@nestjs/testing';
import { MerchantOnboardingService } from './merchant-onboarding.service';

describe('MerchantOnboardingService', () => {
  let service: MerchantOnboardingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MerchantOnboardingService],
    }).compile();

    service = module.get<MerchantOnboardingService>(MerchantOnboardingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
