import type { Interface } from '../layers/datalink';
import {
  HardwareInterfaceMarker,
  NetworkInterfaceMarker,
} from '../layers/layer-base';
import type {
  DatalinkMessage,
  NetworkMessage,
  PhysicalMessage,
  Message,
} from '../message';
import type { GenericNode } from '../nodes/generic';

export enum ActionHandle {
  Continue, // Continue with the original action
  Handled, // Handle the action at the end (don't call it)
  Stop, // Immediately stop the hook chain and handle the original
}

export type EventString =
  | 'OnInterfaceAdded'
  | 'OnInterfaceUp'
  | 'OnInterfaceDown'
  | 'OnInterfaceChange';

export function handleChain(
  handler:
    | 'receiveBits'
    | 'sendBits'
    | 'receiveTrame'
    | 'sendTrame'
    | 'receivePacket'
    | 'sendPacket'
    | 'on',
  listeners: GenericListener[],
  message: Message | EventString,
  sender: Interface | GenericNode,
  receiver?: Interface,
  delay: number = 0
): ActionHandle {
  let ret = ActionHandle.Continue;
  let action = ActionHandle.Continue;

  // eslint-disable-next-line no-restricted-syntax
  for (const i of listeners) {
    // eslint-disable-next-line no-continue
    if (i === sender) continue;

    if (handler in i && handler !== 'on') {
      switch (handler) {
        case 'receiveTrame': {
          ret = (i as DatalinkListener).receiveTrame(
            message as DatalinkMessage,
            sender as Interface
          );
          if (ret > action) action = ret;
          break;
        }
        case 'sendTrame': {
          if (
            'hwInterfaceMarker' in i &&
            i.hwInterfaceMarker instanceof HardwareInterfaceMarker
          )
            (i as DatalinkSender).sendTrame(
              message as DatalinkMessage,
              sender as Interface
            );
          break;
        }

        case 'receivePacket': {
          ret = (i as NetworkListener).receivePacket(
            message as NetworkMessage,
            sender as Interface
          );
          if (ret > action) action = ret;
          break;
        }
        case 'sendPacket': {
          if (
            'netInterfaceMarker' in i &&
            i.netInterfaceMarker instanceof NetworkInterfaceMarker
          )
            (i as NetworkSender).sendPacket(
              message as NetworkMessage,
              sender as Interface
            );
          break;
        }

        case 'receiveBits': {
          if (!receiver)
            throw new Error('receiver is required for receiveBits');

          ret = (i as PhysicalListener).receiveBits(
            message as NetworkMessage,
            sender as Interface,
            receiver
          );
          if (ret > action) action = ret;
          break;
        }
        case 'sendBits': {
          if (!receiver) throw new Error('receiver is required for sendBits');

          (i as PhysicalSender).sendBits(
            message as NetworkMessage,
            sender as Interface,
            receiver,
            delay
          );
          break;
        }

        default:
          break;
      }
    }
    if (typeof i === 'function' && handler === 'on') {
      const result = (i as GenericEventListener)(
        message as EventString,
        sender
      );
      ret = result !== undefined ? result : ActionHandle.Continue;
      if (ret > action) action = ret;
    }

    if (action === ActionHandle.Stop) {
      break;
    }
  }

  return action;
}

export type GenericEventListener = (
  message: EventString,
  sender: Interface | GenericNode
) => ActionHandle | void;
export type GenericListener = GenericClassListener | GenericEventListener;

abstract class GenericClassListener {}

export interface PhysicalListener extends GenericClassListener {
  receiveBits(
    message: PhysicalMessage,
    from: Interface,
    to: Interface
  ): ActionHandle;
}

export interface PhysicalSender extends GenericClassListener {
  sendBits(
    message: PhysicalMessage,
    from: Interface,
    to: Interface,
    delay: number
  ): void;
}

export interface DatalinkListener extends GenericClassListener {
  receiveTrame(message: DatalinkMessage, from: Interface): ActionHandle;
}

export interface DatalinkSender extends GenericClassListener {
  sendTrame(message: DatalinkMessage, from: Interface): void;
}

export interface NetworkListener extends GenericClassListener {
  receivePacket(message: NetworkMessage, from: Interface): ActionHandle;
}

export interface NetworkSender extends GenericClassListener {
  sendPacket(message: NetworkMessage, from: Interface): void;
}

// Packet transmission event for visualization
export interface PacketTransmission {
  message: PhysicalMessage;
  source: Interface;
  destination: Interface;
  delay: number;
}

/**
 * LinkLayerSpy - Listener for physical layer packet transmission events
 * Used for visualizing packet movement in the network diagram
 */
export class LinkLayerSpy implements PhysicalSender, PhysicalListener {
  private sendBitsCallbacks: Array<(transmission: PacketTransmission) => void> =
    [];

  private receiveBitsCallbacks: Array<
    (transmission: PacketTransmission) => void
  > = [];

  public receiveBits(
    message: PhysicalMessage,
    from: Interface,
    to: Interface
  ): ActionHandle {
    this.receiveBitsCallbacks.forEach((callback) => {
      callback({ message, source: from, destination: to, delay: 0 });
    });
    return ActionHandle.Continue;
  }

  public sendBits(
    message: PhysicalMessage,
    from: Interface,
    to: Interface,
    delay: number = 0
  ): void {
    this.sendBitsCallbacks.forEach((callback) => {
      callback({ message, source: from, destination: to, delay });
    });
  }

  public onSendBits(
    callback: (transmission: PacketTransmission) => void
  ): () => void {
    this.sendBitsCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.sendBitsCallbacks = this.sendBitsCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }

  public onReceiveBits(
    callback: (transmission: PacketTransmission) => void
  ): () => void {
    this.receiveBitsCallbacks.push(callback);
    // Return unsubscribe function
    return () => {
      this.receiveBitsCallbacks = this.receiveBitsCallbacks.filter(
        (cb) => cb !== callback
      );
    };
  }
}
