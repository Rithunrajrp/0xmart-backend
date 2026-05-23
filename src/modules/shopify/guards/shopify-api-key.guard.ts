import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ShopifyService } from '../shopify.service';

@Injectable()
export class ShopifyApiKeyGuard implements CanActivate {
  constructor(private shopifyService: ShopifyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('Missing X-API-Key header');
    }

    const store = await this.shopifyService.validateApiKey(apiKey);

    if (!store) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Attach store to request for use in controllers
    request.shopifyStore = store;

    return true;
  }
}
