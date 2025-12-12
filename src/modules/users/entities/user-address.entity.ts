import { AddressType } from '@prisma/client';

export class UserAddressEntity {
  id: string;
  userId: string;
  type: AddressType;
  label?: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  isDefault: boolean;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
