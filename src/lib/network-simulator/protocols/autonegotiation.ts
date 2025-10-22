import type { HardwareInterface } from '../layers/datalink';
import { PhysicalMessage, type Payload } from '../message';
import { ActionHandle, type PhysicalListener } from './base';

//
enum SelectorField {
  Ethernet, // 802.3
  IsLan, // 802.9
}

// http://www.ethermanage.com/ethernet/pdf/dell-auto-neg.pdf
export enum TechnologyField {
  A10BaseT = 1 << 0,
  A10BaseT_FullDuplex = 1 << 1,
  A100BaseTX = 1 << 2,
  A100BaseTX_FullDuplex = 1 << 3,
  // A100BaseT4 =            (1 << 4),

  APause = 1 << 5,
  APause_FullDuplex = 1 << 6,

  AReserved = 1 << 7,
}

export enum AdvancedTechnologyField {
  A1000BaseT = 1 << 0,
  // A1000BaseT_MasterSlave = (1 << 1), // not implemented
  // A1000BaseT_MultiPort =   (1 << 2),
  A1000BaseT_HalfDuplex = 1 << 3,
}

interface BaseLinkCodeWord extends Payload {
  remoteFault: boolean;
  acknowledge: boolean;
  nextPage: boolean;
}

interface LinkCodeWordPage0 extends BaseLinkCodeWord {
  selectorField: SelectorField;
  technologyField: TechnologyField | 0;
}

interface LinkCodeWordPage1 extends BaseLinkCodeWord {
  technologyField: AdvancedTechnologyField | 0;
}

type LinkCodeWords = LinkCodeWordPage0 | LinkCodeWordPage1;

// CL73-AN 802.3ab
// CL73-AN 802.3cd
// CL73-AN 802.3ck

export class AutonegotiationMessage extends PhysicalMessage {
  public override payload: LinkCodeWords;

  private constructor(code: LinkCodeWords) {
    super(code);
    this.payload = code;
  }

  public override toString(): string {
    const ackStatus = this.payload.acknowledge ? 'ACK' : 'REQ';
    return `AutoNegotiation (${ackStatus})`;
  }

  public static Builder = class {
    private fastEthernet: LinkCodeWordPage0;

    private gigaEthernet: LinkCodeWordPage1;

    private minSpeed: number = Number.MIN_SAFE_INTEGER;

    private maxSpeed: number = Number.MAX_SAFE_INTEGER;

    constructor() {
      this.fastEthernet = {
        selectorField: SelectorField.Ethernet,

        technologyField: 0,

        remoteFault: false,
        acknowledge: false,
        nextPage: false,

        length: 2,
      };
      this.gigaEthernet = {
        technologyField: 0,

        remoteFault: false,
        acknowledge: false,
        nextPage: false,

        length: 2,
      };
    }

    public setHalfDuplex(): this {
      // remove flags
      this.fastEthernet.technologyField &= ~TechnologyField.A10BaseT_FullDuplex;
      this.fastEthernet.technologyField &=
        ~TechnologyField.A100BaseTX_FullDuplex;
      this.fastEthernet.technologyField &= ~TechnologyField.APause_FullDuplex;

      // add flag if gig is supported
      if (
        this.gigaEthernet.technologyField & AdvancedTechnologyField.A1000BaseT
      )
        this.gigaEthernet.technologyField |=
          AdvancedTechnologyField.A1000BaseT_HalfDuplex;

      return this;
    }

    public setFullDuplex(): this {
      // add flags
      if (this.fastEthernet.technologyField & TechnologyField.A10BaseT)
        this.fastEthernet.technologyField |=
          TechnologyField.A10BaseT_FullDuplex;
      if (this.fastEthernet.technologyField & TechnologyField.A100BaseTX)
        this.fastEthernet.technologyField |=
          TechnologyField.A100BaseTX_FullDuplex;
      if (this.fastEthernet.technologyField & TechnologyField.APause)
        this.fastEthernet.technologyField |= TechnologyField.APause_FullDuplex;

      // remove flags
      this.gigaEthernet.technologyField &=
        ~AdvancedTechnologyField.A1000BaseT_HalfDuplex;
      return this;
    }

    public setMaxSpeed(speed: number): this {
      this.maxSpeed = speed;

      if (speed >= 10 && this.minSpeed <= 10) {
        this.fastEthernet.technologyField |= TechnologyField.A10BaseT;
        this.fastEthernet.technologyField |=
          TechnologyField.A10BaseT_FullDuplex;
      }
      if (speed >= 100 && this.minSpeed <= 100) {
        this.fastEthernet.technologyField |= TechnologyField.A100BaseTX;
        this.fastEthernet.technologyField |=
          TechnologyField.A100BaseTX_FullDuplex;
      }
      if (speed >= 1000 && this.minSpeed <= 1000) {
        this.gigaEthernet.technologyField |= AdvancedTechnologyField.A1000BaseT;
      }

      return this;
    }

    public setMinSpeed(speed: number): this {
      this.minSpeed = speed;

      if (speed > 10) {
        this.fastEthernet.technologyField &= ~TechnologyField.A10BaseT;
        this.fastEthernet.technologyField &=
          ~TechnologyField.A10BaseT_FullDuplex;
      }

      if (speed > 100) {
        this.fastEthernet.technologyField &= ~TechnologyField.A100BaseTX;
        this.fastEthernet.technologyField &=
          ~TechnologyField.A100BaseTX_FullDuplex;
      }

      if (speed > 1000) {
        this.gigaEthernet.technologyField &=
          ~AdvancedTechnologyField.A1000BaseT;
        // this.gigaEthernet.technologyField &= ~AdvancedTechnologyField.A1000BaseT_MultiPort;
        this.gigaEthernet.technologyField &=
          ~AdvancedTechnologyField.A1000BaseT_HalfDuplex;
      }

      return this;
    }

    public acknowledge(): this {
      this.fastEthernet.acknowledge = true;
      this.gigaEthernet.acknowledge = true;
      return this;
    }

    public build(): AutonegotiationMessage[] {
      const messages: AutonegotiationMessage[] = [];

      messages.push(new AutonegotiationMessage(this.fastEthernet));
      if (this.maxSpeed >= 1000) {
        this.fastEthernet.nextPage = true;
        messages.push(new AutonegotiationMessage(this.gigaEthernet));
      }

      return messages;
    }
  };
}

export class AutoNegotiationProtocol implements PhysicalListener {
  private iface: HardwareInterface;

  private minSpeed: number = Number.MIN_SAFE_INTEGER;

  private maxSpeed: number = Number.MAX_SAFE_INTEGER;

  private fullDuplex: boolean = true;

  private neighbourConfig: LinkCodeWords[] = [];

  private neighbourAcknoledge: LinkCodeWords[] = [];

  constructor(iface: HardwareInterface) {
    this.iface = iface;
    this.iface.addListener(this);
  }

  public negociate(
    minSpeed: number = Number.MIN_SAFE_INTEGER,
    maxSpeed: number = Number.MAX_SAFE_INTEGER,
    fullDuplex: boolean = true
  ): void {
    this.minSpeed = minSpeed;
    this.maxSpeed = maxSpeed;
    this.fullDuplex = fullDuplex;

    const builder = new AutonegotiationMessage.Builder()
      .setMinSpeed(minSpeed)
      .setMaxSpeed(maxSpeed);

    if (fullDuplex) builder.setFullDuplex();
    else builder.setHalfDuplex();

    this.iface.FullDuplex = false;
    this.iface.Speed = minSpeed;
    builder.build().forEach((i) => {
      this.iface.sendBits(i);
    });
  }

  private acknowledge(speed: number, fullDuplex: boolean): void {
    const builder = new AutonegotiationMessage.Builder()
      .setMinSpeed(speed)
      .setMaxSpeed(speed);

    if (fullDuplex) builder.setFullDuplex();
    else builder.setHalfDuplex();

    builder.acknowledge();

    this.iface.FullDuplex = fullDuplex;
    this.iface.Speed = speed;
    builder.build().forEach((i) => {
      this.iface.sendBits(i);
    });
  }

  public receiveBits(message: PhysicalMessage): ActionHandle {
    if (message instanceof AutonegotiationMessage) {
      if (message.payload.acknowledge)
        this.neighbourAcknoledge.push(message.payload);
      else this.neighbourConfig.push(message.payload);

      if (message.payload.nextPage === false) {
        this.setSpeed(message.payload.acknowledge);
        if (message.payload.acknowledge === false)
          this.acknowledge(this.iface.Speed, this.iface.FullDuplex);
      }

      return ActionHandle.Handled;
    }

    return ActionHandle.Continue;
  }

  private setSpeed(ack: boolean): void {
    let speed = 0;
    let duplex = false;
    let testSpeed = 0;
    const config = ack ? this.neighbourAcknoledge : this.neighbourConfig;

    for (let page = 0; page < config.length; page += 1) {
      switch (page) {
        case 0: {
          const code = config[page] as LinkCodeWordPage0;

          testSpeed = 10;
          if (this.minSpeed <= testSpeed && this.maxSpeed >= testSpeed) {
            if (code.technologyField & TechnologyField.A10BaseT) {
              speed = testSpeed;
              duplex = false;
            }
            if (
              code.technologyField & TechnologyField.A10BaseT_FullDuplex &&
              this.fullDuplex
            ) {
              speed = testSpeed;
              duplex = true;
            }
          }

          testSpeed = 100;
          if (this.minSpeed <= testSpeed && this.maxSpeed >= testSpeed) {
            if (code.technologyField & TechnologyField.A100BaseTX) {
              speed = testSpeed;
              duplex = false;
            }
            // if( code.technologyField & TechnologyField.A100BaseT4 ) {
            //  speed = testSpeed;
            //  duplex = false;
            // }
            if (
              code.technologyField & TechnologyField.A100BaseTX_FullDuplex &&
              this.fullDuplex
            ) {
              speed = testSpeed;
              duplex = true;
            }
          }

          break;
        }
        case 1: {
          const code = config[page] as LinkCodeWordPage1;

          testSpeed = 1000;
          if (this.minSpeed <= testSpeed && this.maxSpeed >= testSpeed) {
            if (
              code.technologyField &
              AdvancedTechnologyField.A1000BaseT_HalfDuplex
            ) {
              speed = testSpeed;
              duplex = false;
            }
            if (
              code.technologyField & AdvancedTechnologyField.A1000BaseT &&
              this.fullDuplex
            ) {
              speed = testSpeed;
              duplex = true;
            }
            // if( code.technologyField & AdvancedTechnologyField.A1000BaseT_MultiPort && this.fullDuplex  ) {
            //  speed = testSpeed;
            //  duplex = true;
            // }
          }

          break;
        }
        default: {
          throw new Error('Unsupported page');
        }
      }
    }

    if (speed !== 0) {
      this.iface.Speed = speed;
      this.iface.FullDuplex = duplex;
    }

    if (ack) this.neighbourAcknoledge = [];
    else this.neighbourConfig = [];
  }
}
