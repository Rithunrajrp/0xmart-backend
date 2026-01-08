import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { ContactSupportDto } from './dto/contact-support.dto';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('help')
@Controller('help')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Public()
  @Post('contact')
  @ApiOperation({ summary: 'Submit support ticket via contact form' })
  @ApiResponse({ status: 201, description: 'Support ticket submitted successfully' })
  async submitContactForm(@Body() contactDto: ContactSupportDto) {
    return this.supportService.handleContactForm(contactDto);
  }
}
