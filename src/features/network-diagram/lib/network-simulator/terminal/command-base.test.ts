import { describe, it, expect, beforeEach } from 'vitest';
import { IPAddress } from '../address';
import { RouterHost } from '../nodes/router';
import { Terminal } from './terminal';

describe('Terminal basic test', () => {
  let router: RouterHost;
  let terminalRouter: Terminal;

  beforeEach(() => {
    router = new RouterHost('R', 4);
    terminalRouter = new Terminal(router);
  });

  it('auto-complete', () => {
    expect(terminalRouter.autocomplete('').length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete('plop').length).toBe(0);

    expect(terminalRouter.autocomplete('ena').length).toEqual(1);
    expect(terminalRouter.autocomplete('ena')[0]).toBe('enable');

    expect(terminalRouter.autocomplete('enable').length).toEqual(1);
    expect(terminalRouter.autocomplete('enable')[0]).toBe('enable');

    expect(terminalRouter.exec('enable')).toBe(true);
    expect(terminalRouter.autocomplete('no').length).toBe(0);

    expect(terminalRouter.autocomplete('').length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete('plop').length).toBe(0);
    expect(terminalRouter.autocomplete('conf').length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete('conf ').length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete('conf plop').length).toBe(0);
    expect(terminalRouter.autocomplete('conf term').length).toBeGreaterThan(0);
    expect(terminalRouter.autocomplete('configure plop').length).toBe(0);
    expect(
      terminalRouter.autocomplete('configure term').length
    ).toBeGreaterThan(0);
  });

  it('history and recursive', () => {
    expect(terminalRouter.historyBack()).toBeUndefined();
    expect(terminalRouter.historyForward()).toBeUndefined();
    expect(terminalRouter.exec('enable')).toBe(true);
    expect(terminalRouter.historyBack()).toBe('enable');

    expect(terminalRouter.exec('conf t')).toBe(true);
    expect(terminalRouter.exec('int gig 0/0')).toBe(true);
    expect(terminalRouter.exec('int gig 0/1')).toBe(true);
    expect(terminalRouter.exec('int gig 0/2')).toBe(true);
    expect(terminalRouter.historyBack()).toBe('int gig 0/1');
    expect(terminalRouter.historyBack()).toBe('int gig 0/0');
    expect(terminalRouter.historyForward()).toBe('int gig 0/1');
    expect(terminalRouter.historyForward()).toBe('int gig 0/2');
    expect(terminalRouter.historyForward()).toBe('int gig 0/2');
  });

  it('basic command', () => {
    expect(terminalRouter.exec('enable')).toBe(true);
    expect(terminalRouter.Prompt).toBe(`${terminalRouter.Node.name}#`);
    expect(terminalRouter.exec('exit')).toBe(true);
    expect(terminalRouter.Prompt).toBe(`${terminalRouter.Node.name}$`);
    expect(terminalRouter.exec('enable')).toBe(true);
    expect(terminalRouter.Prompt).toBe(`${terminalRouter.Node.name}#`);
    expect(terminalRouter.exec('end')).toBe(true);
    expect(terminalRouter.Prompt).toBe(`${terminalRouter.Node.name}$`);

    expect(terminalRouter.exec('plop')).toBe(false);
  });

  it('lock', () => {
    router.getInterface(0).setNetAddress(IPAddress.generateAddress());
    router.getInterface(0).up();

    expect(terminalRouter.exec('ping 10.0.0.1')).toBe(true);
    expect(terminalRouter.Locked).toBe(true);
    expect(terminalRouter.exec('enable')).toBe(false);
  });
});
