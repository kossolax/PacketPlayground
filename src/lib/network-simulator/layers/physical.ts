import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import type { PhysicalMessage } from '../message';
import {
  ActionHandle,
  type GenericListener,
  handleChain,
  type PhysicalListener,
  type PhysicalSender,
} from '../protocols/base';
import type { HardwareInterface, Interface } from './datalink';
import type { NetworkInterface } from './network';

export abstract class AbstractLink implements PhysicalListener, PhysicalSender {
  public guid: string = Math.random().toString(36).substring(2, 9);

  public name: string = 'Link';

  public type: string = 'cable';

  private listener: GenericListener[] = [];

  protected iface1: HardwareInterface | null;

  // Promise queue for sequential message transmission (replaces Subject + concatMap)
  private queue1: Promise<void> = Promise.resolve();

  protected iface2: HardwareInterface | null;

  // Promise queue for sequential message transmission (replaces Subject + concatMap)
  private queue2: Promise<void> = Promise.resolve();

  protected length: number;

  public static readonly SPEED_OF_LIGHT: number = 299792458;

  constructor(
    iface1: HardwareInterface | NetworkInterface | null = null,
    iface2: HardwareInterface | NetworkInterface | null = null,
    length: number = 1
  ) {
    this.iface1 =
      iface1 instanceof Object && 'getInterface' in iface1
        ? (iface1 as NetworkInterface).getInterface()
        : (iface1 as HardwareInterface | null);
    this.iface2 =
      iface2 instanceof Object && 'getInterface' in iface2
        ? (iface2 as NetworkInterface).getInterface()
        : (iface2 as HardwareInterface | null);

    this.length = length;

    // No need for explicit subscription - queues start resolved

    if (this.iface1 !== null) this.iface1.connectTo(this);
    if (this.iface2 !== null) this.iface2.connectTo(this);
  }

  public toString(): string {
    return `${this.iface1} <->  ${this.iface2}`;
  }

  public clone(): AbstractLink {
    const node = structuredClone(this);
    node.guid = Math.random().toString(36).substring(2, 9);
    return node;
  }

  public getPropagationDelay(): number {
    return this.length / ((AbstractLink.SPEED_OF_LIGHT * 2) / 3);
  }

  public getTransmissionDelay(bytes: number, speed: number): number {
    // Link type specific transmission delays could be implemented here
    // using this.type for different cable types (fiber, copper, etc.)
    if (Scheduler.getInstance().Speed === SchedulerState.SLOWER) {
      return Math.max(0.1, Math.log2(bytes) / Math.log10(speed) / 10);
    }

    // Standard transmission delay calculation
    const transmissionMultiplier = this.type === 'cable' ? 1 : 1;
    return (
      (bytes / (speed * 1000 * 1000) / Scheduler.getInstance().Transmission) *
      transmissionMultiplier
    );
  }

  public getDelay(bytes: number, speed: number): number {
    if (Scheduler.getInstance().Speed === SchedulerState.PAUSED)
      return 99999999999999;
    return this.getPropagationDelay() + this.getTransmissionDelay(bytes, speed);
  }

  public isConnectedTo(iface: Interface): boolean {
    return this.iface1 === iface || this.iface2 === iface;
  }

  public sendBits(message: PhysicalMessage, source: HardwareInterface): void {
    if (this.iface1 === null || this.iface2 === null)
      throw new Error('Link is not connected');

    const destination = this.iface1 === source ? this.iface2 : this.iface1;

    // Chain promise to queue for sequential execution (replaces concatMap)
    if (this.iface1 === source || source.FullDuplex === false) {
      this.queue1 = this.queue1.then(() =>
        this.enqueue(message, source, destination)
      );
    } else {
      this.queue2 = this.queue2.then(() =>
        this.enqueue(message, source, destination)
      );
    }
  }

  // Replaces Observable pipeline with Promise
  private enqueue(
    message: PhysicalMessage,
    source: HardwareInterface,
    destination: HardwareInterface
  ): Promise<void> {
    // Calculate delay (replaces map operator)
    const propagationDelay = this.getDelay(message.length, source.Speed);

    handleChain(
      'sendBits',
      this.getListener,
      message,
      source,
      destination,
      propagationDelay
    );

    // Wait for delay then execute (replaces switchMap + tap)
    return new Promise<void>((resolve) => {
      Scheduler.getInstance().once(propagationDelay, () => {
        this.receiveBits(message, source, destination);
        resolve();
      });
    });
  }

  public receiveBits(
    message: PhysicalMessage,
    source: HardwareInterface,
    destination: HardwareInterface
  ): ActionHandle {
    handleChain('receiveBits', this.getListener, message, source, destination);

    // send to L2
    destination.receiveBits(message, source);
    return ActionHandle.Continue;
  }

  public getInterface(i: number): HardwareInterface | null {
    if (i === 0) return this.iface1;
    if (i === 1) return this.iface2;
    throw new Error(`Invalid index: ${i}`);
  }

  // ---
  public addListener(listener: GenericListener): void {
    this.removeListener(listener);
    this.listener.push(listener);
  }

  public removeListener(listener: GenericListener): void {
    this.listener = this.listener.filter((l) => l !== listener);
  }

  get getListener(): GenericListener[] {
    return this.listener;
  }
}

export class Link extends AbstractLink {
  public override sendBits(
    message: PhysicalMessage,
    source: HardwareInterface
  ): void {
    super.sendBits(message, source);
  }
}
