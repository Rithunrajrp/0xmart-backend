import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IoTDeviceService } from './iot-device.service';
import { ChatGateway } from '../ai-chat/chat.gateway';

interface ActiveSub {
  deviceId: string;
  userId: string;
  client: any; // mqtt.MqttClient — dynamic require keeps type opaque
}

@Injectable()
export class IoTGatewayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IoTGatewayService.name);
  private subs = new Map<string, ActiveSub>();

  constructor(
    private prisma: PrismaService,
    private deviceService: IoTDeviceService,
    private chatGateway: ChatGateway,
  ) {}

  // ─── Lifecycle ─────────────────────────────────────────────

  async onModuleInit() {
    const devices = await this.prisma.ioTDevice.findMany({
      where: { isEnabled: true },
    });
    for (const d of devices) await this.subscribeDevice(d);
    this.logger.log(`IoT Gateway — subscribed to ${devices.length} device(s).`);
  }

  async onModuleDestroy() {
    for (const sub of this.subs.values()) {
      try {
        sub.client.end();
      } catch {}
    }
    this.subs.clear();
  }

  // ─── Subscribe / Unsubscribe ───────────────────────────────

  async subscribeDevice(device: any) {
    let mqtt: any;
    try {
      mqtt = require('mqtt');
    } catch {
      this.logger.warn('mqtt package not installed — IoT gateway disabled.');
      return;
    }

    // Disconnect any previous subscription for this device
    this.unsubscribeDevice(device.id);

    const password = device.mqttAuthToken
      ? this.deviceService.decryptToken(device.mqttAuthToken)
      : undefined;

    try {
      const client = mqtt.connect(device.mqttBrokerUrl, password ? { password } : {});

      client.on('error', (err: Error) =>
        this.logger.error(`MQTT [${device.id}]: ${err.message}`),
      );

      client.on('connect', () => {
        client.subscribe(device.mqttTopic, (err: Error | null) => {
          if (err)
            this.logger.error(`Subscribe [${device.mqttTopic}]: ${err.message}`);
        });
      });

      client.on('message', (_topic: string, payload: Buffer) => {
        this.handleMessage(device.id, device.userId, payload);
      });

      this.subs.set(device.id, {
        deviceId: device.id,
        userId: device.userId,
        client,
      });
    } catch (err: any) {
      this.logger.error(`MQTT connect [${device.id}]: ${err.message}`);
    }
  }

  unsubscribeDevice(deviceId: string) {
    const sub = this.subs.get(deviceId);
    if (sub) {
      try {
        sub.client.end();
      } catch {}
      this.subs.delete(deviceId);
    }
  }

  // ─── Incoming message ──────────────────────────────────────

  private async handleMessage(
    deviceId: string,
    userId: string,
    payload: Buffer,
  ) {
    let parsed: any;
    try {
      parsed = JSON.parse(payload.toString());
    } catch {
      parsed = { raw: payload.toString() };
    }

    const device = await this.prisma.ioTDevice.findUnique({
      where: { id: deviceId },
    });
    if (!device) return;

    const injectedMessage = this.buildInjectionMessage(device, parsed);

    // Persist event (with injection message if produced)
    await this.deviceService.logEvent(
      deviceId,
      parsed,
      undefined,
      injectedMessage ?? undefined,
    );

    if (injectedMessage) {
      this.chatGateway.pushIoTMessage(userId, injectedMessage);
    }
  }

  // ─── Injection message builder ─────────────────────────────

  private buildInjectionMessage(device: any, payload: any): string | null {
    // items / item array → restock request
    const items =
      payload.items || (payload.item ? [payload.item] : null);
    if (Array.isArray(items) && items.length > 0) {
      const list = items
        .slice(0, device.maxItemsPerRestock)
        .map((i: any) => {
          const name = i.name || i.productName || i.id || 'unknown item';
          const qty = i.quantity || i.qty || 1;
          return `${qty}x ${name}`;
        })
        .join(', ');
      return `[IoT: ${device.name}] Restock request: ${list}. Please search for these products and add them to my cart.`;
    }

    // Passthrough text/message fields
    if (payload.message || payload.text) {
      return `[IoT: ${device.name}] ${payload.message || payload.text}`;
    }

    // Low-stock threshold alert
    if (payload.lowStock || payload.threshold) {
      const product = payload.product || payload.name || 'item';
      return `[IoT: ${device.name}] Low stock alert: ${product}. Please search and replenish.`;
    }

    return null; // unrecognised shape — no injection
  }
}
