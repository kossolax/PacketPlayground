import { describe, it, expect, beforeEach } from 'vitest';
import { Terminal } from '../terminal';
import { RouterHost } from '../../nodes/router';
import { SwitchHost } from '../../nodes/switch';
import { IPAddress } from '../../address';
import {
  Scheduler,
  SchedulerState,
} from '@/features/network-diagram/lib/scheduler';

describe('Terminal show commands test', () => {
  let router: RouterHost;
  let terminalRouter: Terminal;
  let switchHost: SwitchHost;
  let terminalSwitch: Terminal;

  beforeEach(() => {
    // Setup router
    router = new RouterHost('Router-A', 2);
    const iface0 = router.getInterface(0);
    if ('setNetAddress' in iface0) {
      iface0.setNetAddress(new IPAddress('192.168.1.1'));
      iface0.setNetMask(new IPAddress('255.255.255.0', true));
    }
    iface0.up();

    terminalRouter = new Terminal(router);
    terminalRouter.exec('enable'); // Enter admin mode

    // Setup switch
    switchHost = new SwitchHost('Switch-A', 4);
    switchHost.getInterface(0).up();

    terminalSwitch = new Terminal(switchHost);
    terminalSwitch.exec('enable');

    Scheduler.getInstance().Speed = SchedulerState.FASTER;
  });

  describe('Router show commands', () => {
    it('show arp should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(
            new Error(
              'Terminal remained locked - onComplete was never called after show arp'
            )
          );
        }, 1000);

        terminalRouter.onText = (t) => {
          text += `${t}\n`;
        };

        terminalRouter.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalRouter.exec('show arp');
        expect(success).toBe(true);
      });

      expect(result).toContain('Protocol');
      expect(result).toContain('Address');
      expect(terminalRouter.Locked).toBe(false);
    });

    it('show interfaces should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(new Error('Terminal remained locked after show interfaces'));
        }, 1000);

        terminalRouter.onText = (t) => {
          text += `${t}\n`;
        };

        terminalRouter.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalRouter.exec('show interfaces');
        expect(success).toBe(true);
      });

      expect(result).toContain('gig0/0');
      expect(terminalRouter.Locked).toBe(false);
    });

    it('show interfaces status should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(
            new Error('Terminal remained locked after show interfaces status')
          );
        }, 1000);

        terminalRouter.onText = (t) => {
          text += `${t}\n`;
        };

        terminalRouter.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalRouter.exec('show interfaces status');
        expect(success).toBe(true);
      });

      expect(result).toContain('Port');
      expect(result).toContain('Status');
      expect(terminalRouter.Locked).toBe(false);
    });

    it('show ip interface brief should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(
            new Error('Terminal remained locked after show ip interface brief')
          );
        }, 1000);

        terminalRouter.onText = (t) => {
          text += `${t}\n`;
        };

        terminalRouter.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalRouter.exec('show ip interface brief');
        expect(success).toBe(true);
      });

      expect(result).toContain('Interface');
      expect(result).toContain('IP-Address');
      expect(terminalRouter.Locked).toBe(false);
    });

    it('show ip route should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(new Error('Terminal remained locked after show ip route'));
        }, 1000);

        terminalRouter.onText = (t) => {
          text += `${t}\n`;
        };

        terminalRouter.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalRouter.exec('show ip route');
        expect(success).toBe(true);
      });

      expect(result).toContain('Gateway of last resort');
      expect(terminalRouter.Locked).toBe(false);
    });
  });

  describe('Autocomplete tests', () => {
    it('should autocomplete "show ?" with all show commands', () => {
      const suggestions = terminalRouter.autocomplete('show ');
      expect(suggestions).toContain('ip');
      expect(suggestions).toContain('arp');
      expect(suggestions).toContain('interfaces');
    });

    it('should autocomplete "show ip ?" with ip subcommands', () => {
      const suggestions = terminalRouter.autocomplete('show ip ');
      expect(suggestions).toEqual(['interface', 'route']);
    });

    it('should autocomplete "show ip interface ?" with brief', () => {
      const suggestions = terminalRouter.autocomplete('show ip interface ');
      expect(suggestions).toEqual(['brief']);
    });

    it('should autocomplete "show vlan ?" on switch', () => {
      const suggestions = terminalSwitch.autocomplete('show vlan ');
      expect(suggestions).toEqual(['brief']);
    });

    it('should autocomplete "show mac ?" on switch', () => {
      const suggestions = terminalSwitch.autocomplete('show mac ');
      expect(suggestions).toEqual(['address-table']);
    });
  });

  describe('Switch show commands', () => {
    it('show vlan brief should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(new Error('Terminal remained locked after show vlan brief'));
        }, 1000);

        terminalSwitch.onText = (t) => {
          text += `${t}\n`;
        };

        terminalSwitch.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalSwitch.exec('show vlan brief');
        expect(success).toBe(true);
      });

      expect(result).toContain('VLAN');
      expect(result).toContain('Name');
      expect(terminalSwitch.Locked).toBe(false);
    });

    it('show mac address-table should unlock terminal', async () => {
      const result = await new Promise<string>((resolve, reject) => {
        let text = '';
        let completeCalled = false;

        const timeout = setTimeout(() => {
          reject(
            new Error('Terminal remained locked after show mac address-table')
          );
        }, 1000);

        terminalSwitch.onText = (t) => {
          text += `${t}\n`;
        };

        terminalSwitch.onComplete = () => {
          if (!completeCalled) {
            completeCalled = true;
            clearTimeout(timeout);
            resolve(text);
          }
        };

        const success = terminalSwitch.exec('show mac address-table');
        expect(success).toBe(true);
      });

      expect(result).toContain('Mac Address Table');
      expect(terminalSwitch.Locked).toBe(false);
    });
  });
});
