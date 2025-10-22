import { DhcpServer } from '../services/dhcp';
import { L4Host } from './generic';

export class ServerHost extends L4Host {
  public services: { dhcp: DhcpServer };

  constructor(name: string = '', type: string = 'server', iface: number = 0) {
    super(name, type, iface);
    this.services = {
      dhcp: new DhcpServer(this),
    };
  }

  public clone(): ServerHost {
    const clone = new ServerHost();
    this.applyCloneProperties(clone);
    this.cloneInterfaces(clone);
    return clone;
  }
}

export class ComputerHost extends L4Host {
  constructor(name: string = '', type: string = 'pc', iface: number = 0) {
    super(name, type, iface);
  }

  public clone(): ComputerHost {
    const clone = new ComputerHost();
    this.applyCloneProperties(clone);
    this.cloneInterfaces(clone);
    return clone;
  }
}
