import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class IoTDeviceService {
  constructor(private prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────────

  async findAllByUser(userId: string) {
    return this.prisma.ioTDevice.findMany({
      where: { userId },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    return this.prisma.ioTDevice.findFirst({ where: { id, userId } });
  }

  async create(userId: string, raw: Record<string, any>) {
    return this.prisma.ioTDevice.create({
      data: {
        userId,
        name: raw.name as string,
        deviceType: (raw.deviceType as string) || 'generic',
        mqttBrokerUrl: raw.mqttBrokerUrl as string,
        mqttTopic: raw.mqttTopic as string,
        mqttAuthToken: raw.mqttAuthToken
          ? this.encryptToken(raw.mqttAuthToken as string)
          : undefined,
        autoRestockEnabled: raw.autoRestockEnabled ?? false,
        maxItemsPerRestock: raw.maxItemsPerRestock ?? 5,
      },
    });
  }

  async update(id: string, userId: string, raw: Record<string, any>) {
    const existing = await this.findOne(id, userId);
    if (!existing) return null;

    const data: Record<string, any> = {};
    if (raw.name !== undefined) data.name = raw.name;
    if (raw.deviceType !== undefined) data.deviceType = raw.deviceType;
    if (raw.mqttBrokerUrl !== undefined) data.mqttBrokerUrl = raw.mqttBrokerUrl;
    if (raw.mqttTopic !== undefined) data.mqttTopic = raw.mqttTopic;
    if (raw.mqttAuthToken !== undefined)
      data.mqttAuthToken = this.encryptToken(raw.mqttAuthToken as string);
    if (raw.isEnabled !== undefined) data.isEnabled = raw.isEnabled;
    if (raw.autoRestockEnabled !== undefined)
      data.autoRestockEnabled = raw.autoRestockEnabled;
    if (raw.maxItemsPerRestock !== undefined)
      data.maxItemsPerRestock = raw.maxItemsPerRestock;

    return this.prisma.ioTDevice.update({ where: { id }, data });
  }

  async delete(id: string, userId: string) {
    const existing = await this.findOne(id, userId);
    if (!existing) return null;
    return this.prisma.ioTDevice.delete({ where: { id } });
  }

  // ─── Events ────────────────────────────────────────────────

  async logEvent(
    deviceId: string,
    rawPayload: any,
    parsedItems?: any[],
    injectedMessage?: string,
  ) {
    return this.prisma.ioTEvent.create({
      data: {
        deviceId,
        rawPayload,
        parsedItems: parsedItems ?? undefined,
        injectedMessage,
        status: injectedMessage ? 'INJECTED' : 'RECEIVED',
      },
    });
  }

  async getPendingEvents(userId: string) {
    return this.prisma.ioTEvent.findMany({
      where: { device: { userId }, status: 'RECEIVED' },
      include: { device: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Token encryption (AES-256-GCM) ────────────────────────

  private getKey(): Buffer {
    const hex = process.env.IOT_ENCRYPT_KEY;
    if (hex && hex.length >= 64) return Buffer.from(hex.slice(0, 64), 'hex');
    // Dev-only fallback — 32 zero-bytes
    return Buffer.alloc(32, 0x42);
  }

  private encryptToken(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.getKey(), iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  decryptToken(ciphertext: string): string | null {
    try {
      const [ivHex, tagHex, dataHex] = ciphertext.split(':');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.getKey(),
        Buffer.from(ivHex, 'hex'),
      );
      decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
      let decrypted = decipher.update(dataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return null;
    }
  }
}
