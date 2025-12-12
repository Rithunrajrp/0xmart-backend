import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MerchantOnboardingService } from './merchant-onboarding.service';
import { CompleteOnboardingDto } from './dto/complete-onboarding.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('Merchant Onboarding')
@Controller('onboarding')
@Public() // All endpoints are public but require valid onboarding token
export class MerchantOnboardingController {
  constructor(
    private readonly merchantOnboardingService: MerchantOnboardingService,
  ) {}

  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify onboarding token validity (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Token is valid and returns merchant info',
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({
    status: 400,
    description: 'Token expired or onboarding completed',
  })
  async verifyToken(@Param('token') token: string) {
    return this.merchantOnboardingService.verifyToken(token);
  }

  @Post('complete')
  @ApiOperation({
    summary:
      'Complete onboarding form with business details (Public with token)',
  })
  @ApiResponse({
    status: 200,
    description: 'Onboarding form completed successfully',
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({
    status: 400,
    description: 'Token expired or form already completed',
  })
  async completeOnboarding(
    @Body() completeOnboardingDto: CompleteOnboardingDto,
  ) {
    return this.merchantOnboardingService.completeOnboarding(
      completeOnboardingDto,
    );
  }

  @Post('upload-document')
  @ApiOperation({
    summary: 'Upload a document for onboarding (Public with token)',
  })
  @ApiResponse({ status: 200, description: 'Document uploaded successfully' })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({
    status: 400,
    description: 'Token expired or form not completed',
  })
  async uploadDocument(@Body() uploadDocumentDto: UploadDocumentDto) {
    return this.merchantOnboardingService.uploadDocument(uploadDocumentDto);
  }

  @Post('submit-for-review')
  @ApiOperation({
    summary: 'Submit all documents for admin review (Public with token)',
  })
  @ApiResponse({
    status: 200,
    description: 'Documents submitted for review successfully',
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({
    status: 400,
    description: 'Token expired, no documents, or missing required documents',
  })
  async submitForReview(@Body('onboardingToken') onboardingToken: string) {
    return this.merchantOnboardingService.submitForReview(onboardingToken);
  }

  @Get('status/:token')
  @ApiOperation({
    summary: 'Get current onboarding status and progress (Public)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns onboarding status with documents and progress',
  })
  @ApiResponse({ status: 404, description: 'Invalid token' })
  @ApiResponse({ status: 400, description: 'Token expired' })
  async getOnboardingStatus(@Param('token') token: string) {
    return this.merchantOnboardingService.getOnboardingStatus(token);
  }
}
