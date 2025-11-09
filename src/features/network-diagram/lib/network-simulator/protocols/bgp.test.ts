import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../address';
import {
  BGPMessage,
  BGPOpenMessage,
  BGPUpdateMessage,
  BGPNotificationMessage,
  BGPMessageType,
  BGPState,
  BGPErrorCode,
  BGP_VERSION,
  BGP_DEFAULT_HOLD_TIME,
  BGPNLRI,
  BGPPathAttribute,
} from './bgp';

describe('BGP protocol', () => {
  beforeEach(() => {
    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  describe('BGPMessage Builder', () => {
    it('should build basic BGP keepalive message', () => {
      const builder = new BGPMessage.Builder()
        .setBGPType(BGPMessageType.Keepalive)
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'));

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(BGPMessage);

      const bgpMsg = messages[0] as BGPMessage;
      expect(bgpMsg.type).toBe(BGPMessageType.Keepalive);
      expect(bgpMsg.length).toBe(19); // Minimum BGP header
      expect(bgpMsg.marker).toBe(BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'));
    });

    it('should set correct protocol for BGP (TCP)', () => {
      const builder = new BGPMessage.Builder()
        .setNetSource(new IPAddress('10.0.0.1'))
        .setNetDestination(new IPAddress('10.0.0.2'));

      const messages = builder.build();
      const bgpMsg = messages[0] as BGPMessage;

      expect(bgpMsg.protocol).toBe(6); // TCP
    });
  });

  describe('BGPOpenMessage Builder', () => {
    it('should build BGP OPEN message with required fields', () => {
      const builder = new BGPOpenMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .setMyAutonomousSystem(65000)
        .setHoldTime(180)
        .setBGPIdentifier(new IPAddress('1.1.1.1'));

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(BGPOpenMessage);

      const openMsg = messages[0] as BGPOpenMessage;
      expect(openMsg.type).toBe(BGPMessageType.Open);
      expect(openMsg.version).toBe(BGP_VERSION);
      expect(openMsg.myAutonomousSystem).toBe(65000);
      expect(openMsg.holdTime).toBe(180);
      expect(openMsg.bgpIdentifier.toString()).toBe('1.1.1.1');
    });

    it('should validate BGP version', () => {
      const builder = new BGPOpenMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'));

      expect(() => builder.setVersion(3)).toThrow('BGP version must be 4');
    });

    it('should validate AS number range', () => {
      const builder = new BGPOpenMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'));

      expect(() => builder.setMyAutonomousSystem(-1)).toThrow(
        'AS number must be between 0 and 65535'
      );
      expect(() => builder.setMyAutonomousSystem(65536)).toThrow(
        'AS number must be between 0 and 65535'
      );
    });

    it('should validate hold time', () => {
      const builder = new BGPOpenMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'));

      expect(() => builder.setHoldTime(2)).toThrow(
        'Hold time must be 0 or between 3 and 65535 seconds'
      );

      // Valid values
      expect(() => builder.setHoldTime(0)).not.toThrow();
      expect(() => builder.setHoldTime(3)).not.toThrow();
      expect(() => builder.setHoldTime(180)).not.toThrow();
    });

    it('should format OPEN message toString with AS number', () => {
      const openMsg = new BGPOpenMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .setMyAutonomousSystem(65001)
        .setBGPIdentifier(new IPAddress('1.1.1.1'))
        .build()[0] as BGPOpenMessage;

      const str = openMsg.toString();
      expect(str).toContain('BGP');
      expect(str).toContain('OPEN');
      expect(str).toContain('65001');
    });
  });

  describe('BGPUpdateMessage Builder', () => {
    it('should build BGP UPDATE message with advertised routes', () => {
      const nlri1 = new BGPNLRI(new IPAddress('192.168.1.0'), 24);
      const nlri2 = new BGPNLRI(new IPAddress('10.0.0.0'), 8);

      const pathAttr = new BGPPathAttribute(0x40, 2, [65000]);

      const builder = new BGPUpdateMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .addNLRI(nlri1)
        .addNLRI(nlri2)
        .addPathAttribute(pathAttr);

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(BGPUpdateMessage);

      const updateMsg = messages[0] as BGPUpdateMessage;
      expect(updateMsg.type).toBe(BGPMessageType.Update);
      expect(updateMsg.nlri).toHaveLength(2);
      expect(updateMsg.nlri[0].prefix.toString()).toBe('192.168.1.0');
      expect(updateMsg.nlri[0].prefixLength).toBe(24);
      expect(updateMsg.pathAttributes).toHaveLength(1);
    });

    it('should build BGP UPDATE message with withdrawn routes', () => {
      const withdrawn1 = new BGPNLRI(new IPAddress('172.16.0.0'), 16);
      const withdrawn2 = new BGPNLRI(new IPAddress('192.168.0.0'), 16);

      const builder = new BGPUpdateMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .addWithdrawnRoute(withdrawn1)
        .addWithdrawnRoute(withdrawn2);

      const messages = builder.build();

      expect(messages).toHaveLength(1);

      const updateMsg = messages[0] as BGPUpdateMessage;
      expect(updateMsg.withdrawnRoutes).toHaveLength(2);
      expect(updateMsg.withdrawnRoutes[0].prefix.toString()).toBe('172.16.0.0');
      expect(updateMsg.withdrawnRoutes[0].prefixLength).toBe(16);
    });

    it('should format UPDATE message toString with counts', () => {
      const nlri1 = new BGPNLRI(new IPAddress('192.168.1.0'), 24);
      const withdrawn1 = new BGPNLRI(new IPAddress('172.16.0.0'), 16);

      const updateMsg = new BGPUpdateMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .addNLRI(nlri1)
        .addWithdrawnRoute(withdrawn1)
        .build()[0] as BGPUpdateMessage;

      const str = updateMsg.toString();
      expect(str).toContain('BGP');
      expect(str).toContain('UPDATE');
      expect(str).toContain('+1'); // 1 advertised
      expect(str).toContain('-1'); // 1 withdrawn
    });
  });

  describe('BGPNotificationMessage Builder', () => {
    it('should build BGP NOTIFICATION message', () => {
      const builder = new BGPNotificationMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .setErrorCode(BGPErrorCode.HoldTimerExpired)
        .setErrorSubcode(0);

      const messages = builder.build();

      expect(messages).toHaveLength(1);
      expect(messages[0]).toBeInstanceOf(BGPNotificationMessage);

      const notifMsg = messages[0] as BGPNotificationMessage;
      expect(notifMsg.type).toBe(BGPMessageType.Notification);
      expect(notifMsg.errorCode).toBe(BGPErrorCode.HoldTimerExpired);
      expect(notifMsg.errorSubcode).toBe(0);
    });

    it('should include data in NOTIFICATION message', () => {
      const errorData = [1, 2, 3, 4];

      const builder = new BGPNotificationMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .setErrorCode(BGPErrorCode.OpenMessageError)
        .setErrorSubcode(2)
        .setData(errorData);

      const messages = builder.build();
      const notifMsg = messages[0] as BGPNotificationMessage;

      expect(notifMsg.data).toEqual(errorData);
      expect(notifMsg.length).toBe(19 + 2 + errorData.length); // header + error fields + data
    });

    it('should format NOTIFICATION message toString with error name', () => {
      const notifMsg = new BGPNotificationMessage.Builder()
        .setNetSource(new IPAddress('192.168.1.1'))
        .setNetDestination(new IPAddress('192.168.1.2'))
        .setErrorCode(BGPErrorCode.Cease)
        .setErrorSubcode(0)
        .build()[0] as BGPNotificationMessage;

      const str = notifMsg.toString();
      expect(str).toContain('BGP');
      expect(str).toContain('NOTIFICATION');
      expect(str).toContain('Cease');
    });
  });

  describe('BGPNLRI', () => {
    it('should create NLRI with prefix and length', () => {
      const nlri = new BGPNLRI(new IPAddress('192.168.1.0'), 24);

      expect(nlri.prefix.toString()).toBe('192.168.1.0');
      expect(nlri.prefixLength).toBe(24);
    });

    it('should format NLRI as CIDR notation', () => {
      const nlri = new BGPNLRI(new IPAddress('10.0.0.0'), 8);

      const str = nlri.toString();
      expect(str).toBe('10.0.0.0/8');
    });
  });

  describe('BGPPathAttribute', () => {
    it('should create path attribute with flags and type', () => {
      const attr = new BGPPathAttribute(0x40, 2, [65000, 65001]);

      expect(attr.flags).toBe(0x40);
      expect(attr.typeCode).toBe(2);
      expect(attr.value).toEqual([65000, 65001]);
    });

    it('should format path attribute as string', () => {
      const attr = new BGPPathAttribute(0x40, 1, [100]);

      const str = attr.toString();
      expect(str).toContain('Attr');
      expect(str).toContain('type=1');
      expect(str).toContain('len=1');
    });
  });

  describe('BGP Constants', () => {
    it('should have correct BGP version', () => {
      expect(BGP_VERSION).toBe(4);
    });

    it('should have correct default hold time', () => {
      expect(BGP_DEFAULT_HOLD_TIME).toBe(180);
    });

    it('should have all BGP states defined', () => {
      expect(BGPState.Idle).toBe(0);
      expect(BGPState.Connect).toBe(1);
      expect(BGPState.Active).toBe(2);
      expect(BGPState.OpenSent).toBe(3);
      expect(BGPState.OpenConfirm).toBe(4);
      expect(BGPState.Established).toBe(5);
    });

    it('should have all BGP message types defined', () => {
      expect(BGPMessageType.Open).toBe(1);
      expect(BGPMessageType.Update).toBe(2);
      expect(BGPMessageType.Notification).toBe(3);
      expect(BGPMessageType.Keepalive).toBe(4);
    });

    it('should have all BGP error codes defined', () => {
      expect(BGPErrorCode.MessageHeaderError).toBe(1);
      expect(BGPErrorCode.OpenMessageError).toBe(2);
      expect(BGPErrorCode.UpdateMessageError).toBe(3);
      expect(BGPErrorCode.HoldTimerExpired).toBe(4);
      expect(BGPErrorCode.FiniteStateMachineError).toBe(5);
      expect(BGPErrorCode.Cease).toBe(6);
    });
  });
});
