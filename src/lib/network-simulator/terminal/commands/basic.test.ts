import { describe, it, expect, beforeEach } from 'vitest';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';
import { IPAddress } from '../../address';
import { Link } from '../../layers/physical';
import { Terminal } from '../terminal';
import { RouterHost } from '../../nodes/router';

describe('Terminal root test', () => {
  let A: RouterHost;
  let B: RouterHost;
  let terminalRouter: Terminal;

  beforeEach(() => {
    A = new RouterHost('A', 1);
    A.getInterface(0).setNetAddress(new IPAddress('192.168.0.1'));
    A.getInterface(0).up();

    B = new RouterHost('B', 1);
    B.getInterface(0).setNetAddress(new IPAddress('192.168.0.2'));
    B.getInterface(0).up();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const link = new Link(A.getInterface(0), B.getInterface(0), 1);

    terminalRouter = new Terminal(A);
    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  it('ping', () => {
    expect(terminalRouter.exec('ping')).toBe(false);
  });

  it('ping alive', async () => {
    const result = await new Promise<string>((resolve) => {
      let text = '';
      let completeCalled = false;

      terminalRouter.onText = (t) => {
        text = t;
      };

      terminalRouter.onComplete = () => {
        if (!completeCalled) {
          completeCalled = true;
          resolve(text);
        }
      };

      terminalRouter.exec('ping 192.168.0.2');
    });

    expect(result).toContain('alive');
    expect(result).not.toContain('dead');
  });

  it('ping dead', async () => {
    const result = await new Promise<string>((resolve) => {
      let text = '';
      let completeCalled = false;

      terminalRouter.onText = (t) => {
        text = t;
      };

      terminalRouter.onComplete = () => {
        if (!completeCalled) {
          completeCalled = true;
          resolve(text);
        }
      };

      terminalRouter.exec('ping 192.168.0.3');
    });

    expect(result).not.toContain('alive');
    expect(result).toContain('dead');
  });
});
