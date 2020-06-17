import { CoreTerminal } from "../../xterm/src/common/CoreTerminal";
import { ICoreTerminal, CharData, ITerminalOptions } from "../../xterm/src/common/Types";
import { EventEmitter, IEvent, forwardEvent } from "../../xterm/src/common/EventEmitter";
import { IBuffer } from "../../xterm/src/common/buffer/Types";
import { DEFAULT_ATTR_DATA } from "../../xterm/src/common/buffer/BufferLine";
import { C0 } from "../../xterm/src/common/data/EscapeSequences";
import { Widget } from "./widget/Widget";
import { IPty } from "node-pty";
import * as NodePTY from "node-pty";
import * as os from 'os';
import { Logger } from "../common/Logger";
import { IBlessedView } from "./IBlessedView";
import { Reader } from "../common/Reader";
import { File } from "../common/File";

const log = Logger("BlassedXTerm");

class XTerminal extends CoreTerminal {

    private _onTitleChange = new EventEmitter<string>();
    public get onTitleChange(): IEvent<string> { return this._onTitleChange.event; }

    private _onRefreshRows = new EventEmitter<number, number>();
    public get onRefreshRows(): IEvent<number, number> { return this._onRefreshRows.event; }

    private _onCursorMove = new EventEmitter<void>();
    public get onCursorMove(): IEvent<void> { return this._onCursorMove.event; }

    constructor( options: ITerminalOptions ) {
        super( options );

        this._setup();

        this.register(forwardEvent(this._inputHandler.onTitleChange, this._onTitleChange));
        // (this as any).register(this._inputHandler.onRequestBell(() => this.bell()));
        this.register(this._inputHandler.onRequestRefreshRows((num1, num2) => this._onRefreshRows.fire(num1, num2)));
        this.register(this._inputHandler.onRequestReset(() => this.reset()));
        this.register(this._inputHandler.onRequestScroll((eraseAttr, isWrapped) => this.scroll(eraseAttr, isWrapped || undefined)));
        // (this as any).register(this._inputHandler.onRequestWindowsOptionsReport(type => this._reportWindowsOptions(type)));
        this.register(forwardEvent(this._inputHandler.onCursorMove, this._onCursorMove));
    }

    public dispose(): void {
        super.dispose();
        this.write = () => { };
    }

    public get buffer(): IBuffer {
        return this.buffers.active;
    }

    write( data ) {
        this._showCursor();
        this._coreService.triggerDataEvent(data, true);
    }

    focus() {
        if (this._coreService.decPrivateModes.sendFocus) {
            this._coreService.triggerDataEvent(C0.ESC + '[I');
        }
        this._showCursor();
    }

    blur() {
        if (this._coreService.decPrivateModes.sendFocus) {
            this._coreService.triggerDataEvent(C0.ESC + '[O');
            this._onRefreshRows.fire(this.buffer.y, this.buffer.y);
        }
    }

    private _showCursor(): void {
        if (!this._coreService.isCursorInitialized) {
            this._coreService.isCursorInitialized = true;
            this._onRefreshRows.fire(this.buffer.y, this.buffer.y);
        }
    }
}

export class BlessedXterm extends Widget implements IBlessedView {
    options: any;
    shell: string;
    args: string[];

    cursor: string;
    cursorBlink: boolean;
    screenKeys: string;
    termName: string;

    term: XTerminal = null;
    title: string;
    pty: IPty = null;

    reader: Reader = null;

    constructor( options: any, reader: Reader, firstPath: File ) {
        super( { ...options, scrollable: false } );

        this.setReader( reader );
        this.options = options;

        // XXX Workaround for all motion
        if (this.screen.program.tmux && this.screen.program.tmuxVersion >= 2) {
            this.screen.program.enableMouse();
        }

        this.shell = options.shell || process.env.SHELL || (os.platform() === 'win32' ? "powershell.exe" : 'sh');
        
        this.cursor = options.cursor;
        this.cursorBlink = options.cursorBlink;
        this.screenKeys = options.screenKeys;

        this.termName = options.terminal
                || options.term
                || process.env.TERM
                || 'xterm';

        (this.box as any).render = () => {
            this._render();
        };
        this.bootstrap(firstPath);
    }

    bootstrap(firstPath: File) {
        this.term = new XTerminal({
            cols: (this.box.width as number) - (this.box.iwidth as number),
            rows: (this.box.height as number) - (this.box.iheight as number),
            // context: element,
            // document: element,
            // body: element,
            // parent: element,
            cursorBlink: this.cursorBlink,
            // screenKeys: this.screenKeys
        });

        this.on('resize', () => {
            process.nextTick(() => {
                this.term.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
            });
        });

        /*
        this.term.refresh = () => {
            this.render();
        };
        
        this.term.keyDown = () => {};
        this.term.keyPress = () => {};
        
        this.term.open(element);
        */
        
        // Emits key sequences in html-land.
        // Technically not necessary here.
        // In reality if we wanted to be neat, we would overwrite the keyDown and
        // keyPress methods with our own node.js-keys->terminal-keys methods, but
        // since all the keys are already coming in as escape sequences, we can just
        // send the input directly to the handler/socket (see below).
        // this.term.on('data', function(data) {
        //   self.handler(data);
        // });
        
        // Incoming keys and mouse inputs.
        // NOTE: Cannot pass mouse events - coordinates will be off!
        /*
        this.screen.program.input.on('data', (data) => {
            this._onData(data);
        });
        */
        
        this.on("keypress", (ch, keyInfo) => {
            this.ptyKeyWrite(ch, keyInfo);
        });

        /*
        this.box.onScreenEvent('mouse', (data) => {
            if (this.screen.focused !== this.box) return;
        
            if (data.x < (this.box.aleft as number) + (this.box.ileft as number)) return;
            if (data.y < (this.box.atop as number) + (this.box.itop as number)) return;
            if (data.x > (this.box.aleft as number) - (this.box.ileft as number) + (this.box.width as number)) return;
            if (data.y > (this.box.atop as number) - (this.box.itop as number) + (this.box.height as number)) return;
        
            if (this.term.x10Mouse
                || this.term.vt200Mouse
                || this.term.normalMouse
                || this.term.mouseEvents
                || this.term.utfMouse
                || this.term.sgrMouse
                || this.term.urxvtMouse) {
                ;
            } else {
                return;
            }
        
            let b = data.raw[0]
            , x = data.x - (this.box.aleft as number)
            , y = data.y - (this.box.atop as number)
            , s;
        
            if (this.term.urxvtMouse) {
            if ((this.screen.program as any).sgrMouse) {
                b += 32;
            }
            s = '\x1b[' + b + ';' + (x + 32) + ';' + (y + 32) + 'M';
            } else if (this.term.sgrMouse) {
                if (!(this.screen.program as any).sgrMouse) {
                b -= 32;
            }
            s = '\x1b[<' + b + ';' + x + ';' + y
                + (data.action === 'mousedown' ? 'M' : 'm');
            } else {
            if ((this.screen.program as any).sgrMouse) {
                b += 32;
            }
            s = '\x1b[M'
                + String.fromCharCode(b)
                + String.fromCharCode(x + 32)
                + String.fromCharCode(y + 32);
            }
        
            this.handler(s);
        });
        */
        
        this.on('focus', () => {
            this.term.focus();
        });
        
        this.on('blur', () => {
            log.debug( "blur" );
            this.term?.blur();
        });
        
        this.term.onTitleChange((title) => {
            this.title = title;
            this.box.emit('title', title);
        });

        this.term.onRefreshRows( (startRow, endRow) => {
            this._render();
        });
        
        this.box.once('render', () => {
            this.term?.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
        });
        
        this.on('destroy', () => {
            this.kill();
        });
        
        this.pty = NodePTY.spawn(this.shell, this.args, {
            name: this.termName,
            cols: (this.width as number) - (this.box.iwidth as number),
            rows: (this.height as number) - (this.box.iheight as number),
            cwd: firstPath ? firstPath.fullname : process.env.HOME,
            encoding: "utf-8",
            env: this.options.env || process.env
        });

        this.on('resize', () => {
            process.nextTick(() => {
                log.debug( "BLESSED RESIZE !!! - TERMINAL");
                try {
                    this.pty?.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
                } catch (e) {
                    log.debug( e );
                }
            });
        });
        
        this.pty.on('data', (data) => {
            log.debug( "screen write : [%d]", data.length );
            this?.write(data);
            this.screen.render();
        });
        
        this.pty.on('exit', (code) => {
            log.debug( "on exit !!! - %d", code );
            this.box.emit( "process_exit", code );
        });
        
        this.box.onScreenEvent('keypress', () => {
            log.error( "onScreenEvent - box keypress !!!" );
            this.render();
        });

        (this.screen as any)._listenKeys(this);
    }

    ptyKeyWrite( ch, keyInfo ) {
        if ( keyInfo.sequence || ch ) {
            log.debug( "pty write : [%d]", keyInfo.sequence || ch );
            this.pty?.write(keyInfo.sequence || ch);
        }
    }

    _onData(data) {
        if (this.screen.focused === this.box && !this._isMouse(data)) {
            this.pty?.write(data);
        }
    }

    write(data) {
        log.debug( "term write [%d]", data.length );
        return this.term?.write(data);
    }

    public clear(): void {
        if (this.term.buffer.ybase === 0 && this.term.buffer.y === 0) {
          // Don't clear if it's already clear
          return;
        }
        this.term.buffer.lines.set(0, this.term.buffer.lines.get(this.term.buffer.ybase + this.term.buffer.y)!);
        this.term.buffer.lines.length = 1;
        this.term.buffer.ydisp = 0;
        this.term.buffer.ybase = 0;
        this.term.buffer.y = 0;
        for (let i = 1; i < this.term.rows; i++) {
          this.term.buffer.lines.push(this.term.buffer.getBlankLine(DEFAULT_ATTR_DATA));
        }
        this._render();
    }

    _render() {
        const box = this.box as any;
        const screen = this.screen as any;

        const ret = box._render();
        if (!ret) return;

        box.dattr = box.sattr(this.box.style);
      
        let xi = ret.xi + box.ileft
          , xl = ret.xl - box.iright
          , yi = ret.yi + box.itop
          , yl = ret.yl - box.ibottom
          , cursor;
      
        let scrollback = this.term.rows - (yl - yi);

        for (let y = Math.max(yi, 0); y < yl; y++) {
          let line = screen.lines[y];
          if (!line || !this.term.buffers[scrollback + y - yi]) break;
      
          if (y === yi + this.term.buffer.y
              && screen.focused === this.box
              && (this.term.buffer.ydisp === this.term.buffer.ybase)) {
                cursor = xi + this.term.buffer.x;
          } else {
                cursor = -1;
          }
      
          for (let x = Math.max(xi, 0); x < xl; x++) {
            if (!line[x] || !this.term.buffer.lines[scrollback + y - yi][x - xi]) break;

            line[x][0] = this.term.buffer.lines[scrollback + y - yi][x - xi][0];

            if (x === cursor) {
              if (this.cursor === 'line') {
                line[x][0] = box.dattr;
                line[x][1] = '\u2502';
                continue;
              } else if (this.cursor === 'underline') {
                line[x][0] = box.dattr | (2 << 18);
              } else if (this.cursor === 'block' || !this.cursor) {
                line[x][0] = box.dattr | (8 << 18);
              }
            }
      
            line[x][1] = this.term.buffer.lines[scrollback + y - yi][x - xi][1];
      
            // default foreground = 257
            if (((line[x][0] >> 9) & 0x1ff) === 257) {
              line[x][0] &= ~(0x1ff << 9);
              line[x][0] |= ((box.dattr >> 9) & 0x1ff) << 9;
            }
      
            // default background = 256
            if ((line[x][0] & 0x1ff) === 256) {
              line[x][0] &= ~0x1ff;
              line[x][0] |= box.dattr & 0x1ff;
            }
          }
      
          line.dirty = true;
          screen.lines[y] = line;
        }
        return ret;
    }

    _isMouse(buf) {
        let s = buf;
        if (Buffer.isBuffer(s)) {
            if (s[0] > 127 && s[1] === undefined) {
                s[0] -= 128;
                s = '\x1b' + s.toString('utf-8');
            } else {
                s = s.toString('utf-8');
            }
        }
        return (buf[0] === 0x1b && buf[1] === 0x5b && buf[2] === 0x4d)
          || /^\x1b\[M([\x00\u0020-\uffff]{3})/.test(s)
          || /^\x1b\[(\d+;\d+;\d+)M/.test(s)
          || /^\x1b\[<(\d+;\d+;\d+)([mM])/.test(s)
          || /^\x1b\[<(\d+;\d+;\d+;\d+)&w/.test(s)
          || /^\x1b\[24([0135])~\[(\d+),(\d+)\]\r/.test(s)
          || /^\x1b\[(O|I)/.test(s);
    }

    setScroll(offset) {
        this.term.buffer.ydisp = offset;
        return this.box.emit('scroll');
    }

    scrollTo(offset) {
        this.term.buffer.ydisp = offset;
        return this.box.emit('scroll');
    }

    getScroll() {
        return this.term.buffer.ydisp;
    }

    resetScroll() {
        this.term.buffer.ydisp = 0;
        this.term.buffer.ybase = 0;
        return this.box.emit('scroll');
    };

    getScrollHeight() {
        return this.term.rows - 1;
    };

    getScrollPerc() {
        return (this.term.buffer.ydisp / this.term.buffer.ybase) * 100;
    };

    setScrollPerc(i) {
        return this.setScroll((i / 100) * this.term.buffer.ybase | 0);
    };

    screenshot(xi, xl, yi, yl) {
        xi = 0 + (xi || 0);
        if (xl != null) {
          xl = 0 + (xl || 0);
        } else {
          xl = this.term.buffer.lines[0].length;
        }
        yi = 0 + (yi || 0);
        if (yl != null) {
          yl = 0 + (yl || 0);
        } else {
          yl = this.term.buffer.lines.length;
        }
        return this.screen.screenshot(xi, xl, yi, yl, this.term);
    }
    
    kill() {
        this.screen.program.input.removeListener('data', ( data ) => {
            this._onData( data );
        });
        if ( this.term ) {
            this.term.write('\x1b[H\x1b[J');
            this.term.dispose();
            delete this.term;
            this.term = null;
        }
        if (this.pty) {
            try {
                (this.pty as any)?.emit('exit', 0);
                log.debug( "PROCESS KILL - %d", this.pty.pid );
                process.kill( this.pty.pid );
                /* BUG - process stop
                this.pty.kill();
                */
                delete this.pty;
            } catch ( e ) {
                log.error( e );
            }
            this.pty = null;
        }
        log.debug( "kill() END");
    }

    destroy() {
        this.off();
        this.kill();
        super.destroy();
    }


    setReader(reader: Reader) {
        throw new Error("Method not implemented.");
    }
    getReader(): Reader {
        throw new Error("Method not implemented.");
    }
    getWidget(): Widget {
        throw new Error("Method not implemented.");
    }
    

}
