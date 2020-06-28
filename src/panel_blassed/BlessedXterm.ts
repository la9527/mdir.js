import { Widget } from "./widget/Widget";
import { IPty } from "node-pty";
import * as NodePTY from "node-pty";
import * as os from 'os';
import { Logger } from "../common/Logger";
import { IBlessedView } from "./IBlessedView";
import { Reader } from "../common/Reader";
import { File } from "../common/File";
import { XTerminal } from "./xterm/XTerminal";

const log = Logger("BlassedXTerm");

export class BlessedXterm extends Widget implements IBlessedView {
    options: any;
    shell: string;
    args: string[];

    cursorBlink: boolean;
    screenKeys: string;
    termName: string;

    term: XTerminal = null;
    title: string;
    pty: IPty = null;

    reader: Reader = null;

    constructor( options: any, reader: Reader, firstPath: File ) {
        super( { ...options, border: "line", scrollable: false } );

        this.setReader( reader );
        this.options = options;

        // XXX Workaround for all motion
        if (this.screen.program.tmux && this.screen.program.tmuxVersion >= 2) {
            this.screen.program.enableMouse();
        }

        const osShell = {
            "win32": "powershell.exe",
            "darwin": "zsh",
            "linux": "sh"
        };
        this.shell = options.shell || osShell[os.platform()] || process.env.SHELL || "sh";
        this.args = options.args || [];
        
        this.cursorBlink = options.cursorBlink;
        this.screenKeys = options.screenKeys;
        this.box.style = this.box.style || { bg: "default", fg: "default" };
        
        this.termName = options.terminal
                || options.term
                || process.env.TERM
                || 'xterm';

        this.on("detach", () => {
            this.box.screen.program.hideCursor();
        });
        this.on("render", () => {
            if ( this.box.screen.program.cursorHidden ) {
                this.box.screen.program.showCursor();
            }
        });

        (this.box as any).render = () => {
            this._render();
        };
        this.bootstrap(firstPath);
    }

    bootstrap(firstPath: File) {
        this.term = new XTerminal({
            cols: (this.box.width as number) - (this.box.iwidth as number),
            rows: (this.box.height as number) - (this.box.iheight as number),
            cursorBlink: this.cursorBlink
        });

        this.on('resize', () => {
            process.nextTick(() => {
                this.term?.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
            });
        });

        // Incoming keys and mouse inputs.
        // NOTE: Cannot pass mouse events - coordinates will be off!
        /*
        this.screen.program.input.on('data', (data) => {
            this._onData(data);
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

        this.term.onData( (data) => {
            log.debug( "TERM ONDATA : ", data.length );
            this._render();
        });

        this.term.onRefreshRows( (startRow, endRow) => {
            this._render();
            this.screen.draw( this.box.itop + startRow + 1, this.box.itop + endRow + 1 );
        });
        
        this.box.once('render', () => {
            this.term?.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
        });
        
        this.on('destroy', () => {
            this.kill();
        });

        log.debug( "SHELL : %s %s", this.shell, this.args );
        
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
            // log.debug( "screen write : [%s] [%d]", data.trim(), data.length );
            this?.write(data);
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

    ptyKeyWrite( keyInfo ) {
        if ( keyInfo && keyInfo.name !== "enter" && keyInfo ) {
            log.debug( "pty write : [%j]", keyInfo );
            this.pty?.write(keyInfo.sequence || keyInfo.ch);
        } else {
            log.debug( "NOT - pty write : [%j]", keyInfo );
        }
    }

    _onData(data) {
        log.debug( "_onData: %j", data );
        if (this.screen.focused === this.box && !this._isMouse(data) ) {
            this.pty?.write(data);
        }
    }

    write(data) {
        // log.debug( "term write [%d]", data.length );
        return this.term?.write(data);
    }

    public clear(): void {
        if (this.term.buffer.ybase === 0 && this.term.buffer.y === 0) {
          // Don't clear if it's already clear
          return;
        }
        this.term.clear();
        this._render();
    }

    _render() {
        const box = this.box as any;
        const screen = this.screen as any;

        const ret = box._render();
        if (!ret) return;

        if ( !this.term ) {
            log.debug( "term is null !!!" );
            return;
        }

        box.dattr = box.sattr(this.box.style);
      
        let xi = ret.xi + box.ileft
          , xl = ret.xl - box.iright
          , yi = ret.yi + box.itop
          , yl = ret.yl - box.ibottom
          , cursor;
      
        let scrollback = this.term.buffer.lines.length - (yl - yi);

        for (let y = Math.max(yi, 0); y < yl; y++) {
            let line = screen.lines[y];
            const bufferLine = this.term.buffer.lines.get(scrollback + y - yi);
            if ( !bufferLine ) {
                continue;
            }

            if (!line) break;

            if (y === yi + this.term.buffer.y
                && this.screen.focused === this.box
                && (this.term.buffer.ydisp === this.term.buffer.ybase)) {
                cursor = xi + this.term.buffer.x;
            } else {
                cursor = -1;
            }

            // const str = bufferLine.translateToString(true);
            // log.debug( "line : %d, COLOR [%d/%d] [%d] [%s]", scrollback + y - yi, bufferLine.getFg(0), bufferLine.getBg(0), str.length, str );

            for (let x = Math.max(xi, 0); x < xl; x++) {
                if (!line[x]) break;

                line[x][0] = (this.box as any).sattr({
                    bold: false,
                    underline: false,
                    blink: false,
                    inverse: false,
                    invisible: false,
                    bg: bufferLine.getBg(x - xi) || this.box.style.bg,
                    fg: bufferLine.getFg(x - xi) || this.box.style.fg,
                });

                if (x === cursor) {
                    // if (this.cursor === 'block' || !this.cursor) {
                      line[x][0] = (this.box as any).sattr({
                            bold: false,
                            underline: false,
                            blink: false,
                            inverse: false,
                            invisible: false,
                            bg: this.box.style.bg,
                            fg: this.box.style.fg,
                        }) | (8 << 18);
                    // }
                }

                line[x][1] = bufferLine.getString(x - xi) || ' ';
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
        /*
        this.screen.program.input.removeListener('data', ( data ) => {
            this._onData( data );
        });
        */
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

    getReader() {
        return this.reader;
    }

    setReader( reader ) {
        this.reader = reader;
    }

    getWidget() {
        return this;
    }

    getCurrentPath() {
        
    }
}
