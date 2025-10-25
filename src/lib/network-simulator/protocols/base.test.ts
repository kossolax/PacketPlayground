import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleChain,
  DatalinkSender,
  DatalinkListener,
  ActionHandle,
  NetworkSender,
  NetworkListener,
  type GenericEventListener,
  type EventString,
} from './base';
import { DatalinkMessage, NetworkMessage, PhysicalMessage } from '../message';
import { HardwareInterface, type Interface } from '../layers/datalink';
import { MacAddress } from '../address';
import { NetworkInterface } from '../layers/network';
import { RouterHost } from '../nodes/router';
import type { GenericNode } from '../nodes/generic';
import {
  HardwareInterfaceMarker,
  NetworkInterfaceMarker,
} from '../layers/layer-base';

// Test spy classes to replace RxJS-based ones
class LinkLayerSpyTest implements DatalinkListener, DatalinkSender {
  public receivedBits: PhysicalMessage[] = [];

  public sentBits: PhysicalMessage[] = [];

  public onReceiveBits?: (message: PhysicalMessage) => void;

  public onSendBits?: (message: PhysicalMessage) => void;

  receiveBits(
    message: PhysicalMessage,
    _from: Interface,
    _to: Interface
  ): ActionHandle {
    this.receivedBits.push(message);
    this.onReceiveBits?.(message);
    return ActionHandle.Continue;
  }

  sendBits(message: PhysicalMessage): void {
    this.sentBits.push(message);
    this.onSendBits?.(message);
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  receiveTrame(): ActionHandle {
    return ActionHandle.Continue;
  }

  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  sendTrame(): void {
    // Not used
  }
}

class HardwareLayerSpy implements DatalinkSender, DatalinkListener {
  public receivedTrames: DatalinkMessage[] = [];

  public sentTrames: DatalinkMessage[] = [];

  public onReceiveTrame?: (message: DatalinkMessage) => void;

  public onSendTrame?: (message: DatalinkMessage) => void;

  hwInterfaceMarker = new HardwareInterfaceMarker();

  // eslint-disable-next-line class-methods-use-this
  receiveTrame(message: DatalinkMessage): ActionHandle {
    this.receivedTrames.push(message);
    this.onReceiveTrame?.(message);
    return ActionHandle.Continue;
  }

  // eslint-disable-next-line class-methods-use-this
  sendTrame(message: DatalinkMessage): void {
    this.sentTrames.push(message);
    this.onSendTrame?.(message);
  }
}

class NetworkLayerSpy implements NetworkSender, NetworkListener {
  public receivedPackets: NetworkMessage[] = [];

  public sentPackets: NetworkMessage[] = [];

  public onReceivePacket?: (message: NetworkMessage) => void;

  public onSendPacket?: (message: NetworkMessage) => void;

  netInterfaceMarker = new NetworkInterfaceMarker();

  receivePacket(message: NetworkMessage): ActionHandle {
    this.receivedPackets.push(message);
    this.onReceivePacket?.(message);
    return ActionHandle.Continue;
  }

  sendPacket(message: NetworkMessage): void {
    this.sentPackets.push(message);
    this.onSendPacket?.(message);
  }
}

describe('handleChain', () => {
  let pc: RouterHost;

  beforeEach(() => {
    pc = new RouterHost('PC', 1);
  });

  it('send / receive bits', () => {
    const spy = new LinkLayerSpyTest();
    const message = new PhysicalMessage(`Hello World!${Math.random()}`);

    const loopback = pc.getInterface(0).getInterface(0);
    handleChain('receiveBits', [spy], message, loopback, loopback);
    handleChain('sendBits', [spy], message, loopback, loopback);

    expect(spy.receivedBits[0]).toEqual(spy.sentBits[0]);
  });

  it('send / receive trames', () => {
    const spy = new HardwareLayerSpy();
    const message = new DatalinkMessage(
      new PhysicalMessage(`Hello World!${Math.random()}`),
      MacAddress.generateAddress(),
      MacAddress.generateAddress()
    );

    const loopback = pc.getInterface(0).getInterface(0);
    handleChain('receiveTrame', [spy], message, loopback, loopback);
    handleChain('sendTrame', [spy], message, loopback, loopback);

    expect(spy.receivedTrames[0]).toEqual(spy.sentTrames[0]);
  });

  it('send / receive packets', () => {
    const spy = new NetworkLayerSpy();
    const message = new NetworkMessage(
      new PhysicalMessage(`Hello World!${Math.random()}`),
      MacAddress.generateAddress(),
      MacAddress.generateAddress()
    );

    const loopback = pc.getInterface(0);
    handleChain('receivePacket', [spy], message, loopback);
    handleChain('sendPacket', [spy], message, loopback);

    expect(spy.receivedPackets[0]).toEqual(spy.sentPackets[0]);
  });

  it('on OnInterfaceAdded', () =>
    new Promise<void>((resolve) => {
      const callback: GenericEventListener = (message) => {
        expect(message).toEqual('OnInterfaceAdded');
        resolve();
      };

      pc.addListener(callback);
      pc.addInterface();
    }));

  it('on OnInterfaceUp', () =>
    new Promise<void>((resolve) => {
      const events: Array<{
        message: EventString;
        sender: Interface | GenericNode;
      }> = [];

      const callback: GenericEventListener = (message, sender) => {
        events.push({ message, sender });
        if (events.length === 2) {
          expect(events[0].message).toEqual('OnInterfaceUp');
          expect(events[0].sender).toBeInstanceOf(NetworkInterface);
          expect(events[1].message).toEqual('OnInterfaceUp');
          expect(events[1].sender).toBeInstanceOf(HardwareInterface);
          resolve();
        }
      };

      const testPc = new RouterHost('PC', 1);
      testPc.addListener(callback);
      testPc.getInterface(0).up();
    }));

  it('on OnInterfaceDown', () =>
    new Promise<void>((resolve) => {
      const events: Array<{
        message: EventString;
        sender: Interface | GenericNode;
      }> = [];

      const callback: GenericEventListener = (message, sender) => {
        events.push({ message, sender });
        if (events.length === 2) {
          expect(events[0].message).toEqual('OnInterfaceDown');
          expect(events[0].sender).toBeInstanceOf(NetworkInterface);
          expect(events[1].message).toEqual('OnInterfaceDown');
          expect(events[1].sender).toBeInstanceOf(HardwareInterface);
          resolve();
        }
      };

      const testPc = new RouterHost('PC', 1);
      testPc.addListener(callback);
      testPc.getInterface(0).down();
    }));

  it('on OnInterfaceChange', () =>
    new Promise<void>((resolve) => {
      const callback: GenericEventListener = (message) => {
        expect(message).toEqual('OnInterfaceChange');
        resolve();
      };

      const testPc = new RouterHost('PC', 1);
      testPc.addListener(callback);
      testPc.getInterface(0).setMacAddress(MacAddress.generateAddress());
    }));

  it('on Action handler', () =>
    new Promise<void>((resolve, reject) => {
      let stopCalled = false;

      const shouldContinue: GenericEventListener = (message) => {
        expect(message).toEqual('OnInterfaceChange');
        return ActionHandle.Continue;
      };

      const shouldHandle: GenericEventListener = (message) => {
        expect(message).toEqual('OnInterfaceChange');
        return ActionHandle.Handled;
      };

      const shouldStop: GenericEventListener = (message) => {
        expect(message).toEqual('OnInterfaceChange');
        stopCalled = true;
        return ActionHandle.Stop;
      };

      const shouldNotBeCalled: GenericEventListener = () => {
        reject(new Error('Should not be called'));
        return ActionHandle.Continue;
      };

      const testPc = new RouterHost('PC', 1);

      testPc.addListener(shouldContinue);
      testPc.addListener(shouldHandle);
      testPc.addListener(shouldContinue);
      testPc.addListener(shouldStop);
      testPc.addListener(shouldContinue);
      testPc.addListener(shouldHandle);
      testPc.addListener(shouldContinue);
      testPc.addListener(shouldNotBeCalled);

      testPc.getInterface(0).setMacAddress(MacAddress.generateAddress());

      // Wait a bit to ensure shouldNotBeCalled is not called
      setTimeout(() => {
        expect(stopCalled).toBe(true);
        resolve();
      }, 100);
    }));
});
