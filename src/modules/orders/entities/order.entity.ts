import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, StablecoinType } from '@prisma/client';

export class OrderItemEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  productId: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  pricePerUnit: string;

  @ApiProperty()
  totalPrice: string;

  @ApiProperty()
  product: {
    id: string;
    name: string;
    imageUrl: string | null;
  };
}

export class OrderEntity {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ enum: StablecoinType })
  stablecoinType: StablecoinType;

  @ApiProperty()
  subtotal: string;

  @ApiProperty()
  tax: string;

  @ApiProperty()
  total: string;

  @ApiProperty({ enum: OrderStatus })
  status: OrderStatus;

  @ApiProperty()
  shippingAddress: any;

  @ApiProperty()
  trackingNumber: string | null;

  @ApiProperty({ type: [OrderItemEntity] })
  items: OrderItemEntity[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  paidAt: Date | null;

  @ApiProperty()
  shippedAt: Date | null;

  @ApiProperty()
  deliveredAt: Date | null;
}
