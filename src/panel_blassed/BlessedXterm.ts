/* eslint-disable @typescript-eslint/member-ordering */
/* eslint-disable no-control-regex */
import { Widget } from "./widget/Widget";
import { IPty } from "node-pty";
import * as NodePTY from "node-pty";
import * as os from "os";
import { Logger } from "../common/Logger";
import { IBlessedView } from "./IBlessedView";
import { Reader } from "../common/Reader";
import { File } from "../common/File";
import { XTerminal } from "./xterm/XTerminal";
import { AttributeData } from "./xterm/common/buffer/AttributeData";
import { ColorConfig } from "../config/ColorConfig";
import which from "which";
import { KeyMappingInfo, KeyMapping, IHelpService, Hint, Help, RefreshType } from "../config/KeyMapConfig";
import { T } from "../common/Translation";
import { SftpReader } from "../panel/sftp/SftpReader";
import { IEvent } from "xterm";
import { EventEmitter } from "./xterm/common/EventEmitter";

const log = Logger("BlassedXTerm");

interface IOSC1337 {
    [ text: string ]: string;
    RemoteHost?: string;
    CurrentDir?: string;
}

class SshPty implements IPty {
    private _ssh2Socket;
    private _stream;
    private _cols;
    private _rows;

    constructor( { reader, cols, rows, term, result }: {
        reader: SftpReader;
        cols: number;
        rows: number;
        term: string;
        result: ( err?: string ) => void;
    } ) {
        log.debug( "shellInit: %j", { cols, rows, term } );
        this._ssh2Socket = reader.getSSH2Client();
        this._ssh2Socket.on("close", () => {
            log.debug( "this._ssh2Socket: close !!!" );
            this._stream = null;
            this._onExit.fire( { exitCode: -1, signal: -1 } );
        });
        this._ssh2Socket.shell({ term, cols, rows }, (err, stream) => {
            if ( err ) {
                log.error( "shellInit: ERROR: %s", err );
                result( err );
                return;
            }
            this._stream = stream;
            this.initEvent();
            result();
        });
    }

    protected initEvent() {
        this._stream.on("data", (data) => {
            this._onData.fire( data );
        });
        this._stream.on("close", () => {
            this._onExit.fire( { exitCode: -1, signal: -1 } );
        });
    }

    protected get socket() {
        return this._ssh2Socket;
    }

    protected get stream() {
        return this._stream;
    }

    get pid() {
        return -1;
    }

    get cols() {
        return this._cols;
    }

    get rows() {
        return this._rows;
    }

    get process() {
        return "ssh";
    }

    handleFlowControl: boolean;
    
    private _onData = new EventEmitter<string>();
    public get onData(): IEvent<string> { return this._onData.event; }

    private _onExit = new EventEmitter<{ exitCode: number; signal?: number }>();
    public get onExit(): IEvent<{ exitCode: number; signal?: number }> { return this._onExit.event; }
    
    on(event: any, listener: any) {
        if ( event === "data" ) {
            this._stream?.on( event, listener );
        } else if ( event === "exit" ) {
            this._stream?.on( "close", (code, signal) => {
                log.error( "close %d %d", code, signal );
                listener( code, signal );
            });
        }
    }

    resize(columns: number, rows: number): void {
        this.stream?.setWindow( rows, columns );
    }

    write(data: string): void {
        this.stream?.write( data );
    }

    kill(signal: string): void {
        this.stream?.signal( signal || "KILL" );
    }
}


@KeyMapping(KeyMappingInfo.XTerm)
export class BlessedXterm extends Widget implements IBlessedView, IHelpService {
    options: any;
    shell: string;
    args: string[];

    cursorBlink: boolean;
    screenKeys: string;
    termName: string;

    term: XTerminal = null;
    pty: IPty = null;

    reader: Reader = null;

    panel: Widget = null;
    header: Widget = null;

    osc1337: IOSC1337 = {};

    isCursorDraw: boolean = false;
    cursorPos = { y: -1, x: -1 };

    constructor( options: any, reader: Reader, firstPath: File ) {
        super( { ...options, scrollable: false } );

        const statColor = ColorConfig.instance().getBaseColor("stat");

        this.panel = new Widget({
            parent: this,
            border: "line",
            left: 0,
            top: 1,
            width: "100%",
            height: "100%-2",
            scrollable: true
        });

        this.header = new Widget({
            parent: this,
            left: 0,
            top: 0,
            width: "100%",
            height: 1,
            style: {
                bg: statColor.back,
                fg: statColor.font
            }
        });

        this.setReader( reader );
        this.options = options;

        // XXX Workaround for all motion
        if (this.screen.program.tmux && this.screen.program.tmuxVersion >= 2) {
            this.screen.program.enableMouse();
        }

        const osShell = {
            "win32": [ "powershell.exe", "cmd.exe" ],
            "darwin": [ "zsh", "bash", "sh" ],
            "linux": [ "zsh", "bash", "sh" ]
        };
        
        this.shell = options.shell || this.shellCheck(osShell[os.platform()]) || process.env.SHELL || "sh";
        this.args = options.args || [];
        
        this.cursorBlink = options.cursorBlink;
        this.screenKeys = options.screenKeys;

        this.box.style = this.box.style || { bg: "default", fg: "default" };
        this.panel.box.style = this.panel.box.style || { bg: "default", fg: "default" };
        
        this.termName = options.terminal
                || options.term
                || process.env.TERM
                || "xterm";

        this.panel.on("detach", () => {
            log.debug( "HIDE CURSOR !!!");
            this.box.screen.program.hideCursor();
        });
        this.panel.on("render", () => {
            if ( this.box.screen.program.cursorHidden ) {
                log.debug( "SHOW CURSOR !!!");
                this.box.screen.program.showCursor();
            }
        });

        (this.panel.box as any).render = () => {
            this._render();
        };
        this.bootstrap(firstPath);
    }

    viewName() {
        return "XTerm";
    }

    setBoxDraw( boxDraw: boolean ) {
        this.panel.setBorderLine( boxDraw );
    }

    hasBoxDraw(): boolean {
        return this.panel.hasBorderLine();
    }

    shellCheck( cmd: string[] ) {
        for ( const item of cmd ) {
            try {
                if ( which.sync(item) ) {
                    return item;
                }
            // eslint-disable-next-line no-empty
            } catch ( e ) {}
        }
        return null;
    }

    bootstrap(firstPath: File) {
        const box = this.panel.box;
        this.term = new XTerminal({
            cols: (box.width as number) - (box.iwidth as number),
            rows: (box.height as number) - (box.iheight as number),
            cursorBlink: this.cursorBlink
        });

        // Incoming keys and mouse inputs.
        // NOTE: Cannot pass mouse events - coordinates will be off!
        /*
        this.screen.program.input.on('data', (data) => {
            this._onData(data);
        });
        */

        this.panel.on("focus", () => {
            this.term.focus();
        });

        this.panel.on("blur", () => {
            this.term && this.term.blur();
        });

        this.on("focus", () => {
            this.term.focus();
        });
        
        this.on("blur", () => {
            this.term && this.term.blur();
        });
        
        this.term.onTitleChange((title) => {
            this.header.setContent( title || "" );
        });

        this.term.onData( () => {
            this._render();
        });

        this.term.onRefreshRows( (startRow, endRow) => {
            this._render(startRow, endRow);
        });
        
        this.panel.box.once("render", () => {
            this.term && this.term.resize((box.width as number) - (box.iwidth as number), (box.height as number) - (box.iheight as number));
        });
        
        this.panel.on("destroy", () => {
            this.kill();
        });

        log.debug( "SHELL : %s %s", this.shell, this.args );

        const initPtyEvent = () => {
            this.on("resize", () => {
                log.debug( "PANEL - resize !!!" );
                process.nextTick(() => {
                    log.debug( "BLESSED TERM RESIZE !!! - TERMINAL");
                    this.term && this.term.resize((box.width as number) - (box.iwidth as number), (box.height as number) - (box.iheight as number));
                });
                process.nextTick(() => {
                    log.debug( "BLESSED PTY RESIZE !!! - TERMINAL");
                    try {
                        this.pty.resize((box.width as number) - (box.iwidth as number), (box.height as number) - (box.iheight as number));
                    } catch (e) {
                        log.debug( e );
                    }
                });
            });
    
            this.pty.on("data", (data) => {
                // log.debug( "screen write : [%s] [%d]", data.trim(), data.length );
                this.parseOSC1337(data); 
                this.write(data);
            });
    
            this.pty.on("exit", (code) => {
                log.debug( "on exit !!! - %d", code );
                this.box.emit( "process_exit", code );
            });
        };

        if ( this.getReader() instanceof SftpReader ) {
            const sftpReader = this.getReader() as SftpReader;
            const sshPty = new SshPty({
                reader: this.getReader() as SftpReader,
                term: this.termName,
                cols: (box.width as number) - (box.iwidth as number),
                rows: (box.height as number) - (box.iheight as number),
                result: (err) => {
                    if ( err ) {
                        this.box.emit( "error", err );
                    } else {
                        this.pty = sshPty;
                        initPtyEvent();
                    }
                }
            });
            this.header.setContent( sftpReader.getConnectInfo() );
        } else {
            try {
                this.pty = NodePTY.spawn(this.shell, this.args, {
                    name: this.termName,
                    cols: (box.width as number) - (box.iwidth as number),
                    rows: (box.height as number) - (box.iheight as number),
                    cwd: firstPath ? firstPath.fullname : process.env.HOME,
                    encoding: os.platform() !== "win32" ? "utf-8" : null,
                    env: this.options.env || process.env
                });
                initPtyEvent();
            } catch( e ) {
                log.error( e );
                process.nextTick(() => {
                    this.box.emit( "error", e );
                });
                return;
            }
            this.header.setContent( [ this.shell, ...(this.args || []) ].join(" ") || "" );
        }
        (this.screen as any)._listenKeys(this);
    }

    /**
     * ref.) 
     *   1. https://iterm2.com/documentation-escape-codes.html
     *   2. http://www.iterm2.com/documentation-shell-integration.html
     */
    parseOSC1337( data ) {
        const convertProps = ( text ) => {
            const j = text.split("=");
            if (j.length > 1) {
                this.osc1337[ j[0] ] = j.slice(1).join("=");
            }
        };

        const findOSC1337 = ( text ) => {
            const idx1 = text.indexOf("\x1b]1337;");
            if ( idx1 > -1 ) {
                const idx2 = text.indexOf("\x07", idx1);
                if ( idx2 > -1 ) {
                    text.substring(idx1 + 7, idx2).split(";").forEach((item) => convertProps(item));
                    findOSC1337( text.substr(idx2+1) );
                }
            }
        };
        findOSC1337(data);
        // log.debug( this.osc1337 );
    }

    hasFocus() {
        return this.panel.hasFocus();
    }

    setFocus() {
        this.panel.setFocus();
    }

    ptyKeyWrite( keyInfo ): RefreshType {
        if ( keyInfo && keyInfo.name !== "enter" && keyInfo ) {
            log.debug( "pty write : [%j]", keyInfo );
            this.pty && this.pty.write(keyInfo.sequence || keyInfo.ch);
            return RefreshType.OBJECT;
        } else {
            log.debug( "NOT - pty write : [%j]", keyInfo );
        }
        return RefreshType.NONE;
    }

    _onData(data: string) {
        if (this.screen.focused === this.panel.box && !this._isMouse(data) ) {
            this.pty && this.pty.write(data);
        }
    }

    write(data) {
        // log.debug( "term write [%d]", data.length );
        return this.term.write(data);
    }

    public clear(): void {
        if (this.term.buffer.ybase === 0 && this.term.buffer.y === 0) {
            // Don't clear if it's already clear
            return;
        }
        this.term.clear();
        this._render();
    }

    _render(startRow = -1, endRow = -1) {
        const box = this.panel.box as any;
        const screen = this.screen as any;

        let ret = null;
        try {
            ret = box._render();
        } catch( e ) {
            log.error( e );
            this.cursorPos = { y: -1, x: -1 };
            return;
        }

        if (!ret) {
            this.cursorPos = { y: -1, x: -1 };
            return;
        }

        if ( !this.term ) {
            log.debug( "term is null !!!" );
            this.cursorPos = { y: -1, x: -1 };
            return;
        }

        box.dattr = box.sattr(box.style);
      
        // eslint-disable-next-line prefer-const
        let xi = ret.xi + box.ileft, xl = ret.xl - box.iright, yi = ret.yi + box.itop, yl = ret.yl - box.ibottom, cursor;
      
        //let scrollback = this.term.buffer.lines.length - (yl - yi);
        // let scrollback = this.term.buffer.ydisp - (yl - yi);
        const scrollback = this.term.buffer.ydisp;

        this.cursorPos = { y: yi + this.term.buffer.y, x: xi + this.term.buffer.x };

        for (let y = Math.max(yi, 0); y < yl; y++) {
            const line = screen.lines[y];
            const bufferLine = this.term.buffer.lines.get(scrollback + y - yi);
            if ( !bufferLine ) {
                continue;
            }

            if (!line) break;

            if ( this.isCursorDraw ) {
                if (y === yi + this.term.buffer.y
                    && this.screen.focused === box
                    && (this.term.buffer.ydisp === this.term.buffer.ybase)) {
                    cursor = xi + this.term.buffer.x;
                } else {
                    cursor = -1;
                }
            }

            // const str = bufferLine.translateToString(true);
            // log.debug( "line : %d, COLOR [%d/%d] [%d] [%s]", scrollback + y - yi, bufferLine.getFg(0), bufferLine.getBg(0), str.length, str );

            const attr = new AttributeData();

            for (let x = Math.max(xi, 0); x < xl; x++) {
                if (!line[x]) break;

                attr.bg = bufferLine.getBg(x - xi);
                attr.fg = bufferLine.getFg(x - xi);

                const sattr = {
                    bold: !!attr.isBold(),
                    underline: !!attr.isUnderline(),
                    blink: !!attr.isBlink(),
                    inverse: !!attr.isInverse(),
                    invisible: !!attr.isInvisible(),
                    bg: attr.getBgColor(),
                    fg: attr.getFgColor()
                };
                line[x][0] = (box as any).sattr(sattr);

                if ( this.isCursorDraw && x === cursor) {
                    line[x][0] = (box as any).sattr({
                        bold: false,
                        underline: false,
                        blink: false,
                        inverse: false,
                        invisible: false,
                        bg: box.style.bg,
                        fg: box.style.fg,
                    }) | (8 << 18);
                }
                line[x][1] = bufferLine.getString(x - xi) || " ";

                /*
                if ( line[x][1] === "." ) {
                    log.debug( "[%s] %j", line[x][1], sattr );
                }
                */
            }

            line.dirty = true;
            screen.lines[y] = line;
        }

        if ( startRow !== -1 && endRow !== -1 ) {
            screen.draw(yi + startRow, yi + endRow);
        }
        return ret;
    }

    updateCursor() {
        if ( !this.isCursorDraw ) {
            const { x, y } = this.cursorPos;
            log.debug( "updateCursor: Row %d/ Col %d", y, x);
            if ( this.panel.box && x > -1 && y > -1 ) {
                this.panel.box.screen.program.cursorPos( y, x );
            }
        }
    }

    _isMouse(buf) {
        let s = buf;
        if (Buffer.isBuffer(s)) {
            if (s[0] > 127 && s[1] === undefined) {
                s[0] -= 128;
                s = "\x1b" + s.toString("utf-8");
            } else {
                s = s.toString("utf-8");
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
        return this.panel.box.emit("scroll");
    }

    scrollTo(offset) {
        this.term.buffer.ydisp = offset;
        return this.panel.box.emit("scroll");
    }

    getScroll() {
        return this.term.buffer.ydisp;
    }

    resetScroll() {
        this.term.buffer.ydisp = 0;
        this.term.buffer.ybase = 0;
        return this.panel.box.emit("scroll");
    }

    getScrollHeight() {
        return this.term.rows - 1;
    }

    getScrollPerc() {
        return (this.term.buffer.ydisp / this.term.buffer.ybase) * 100;
    }

    setScrollPerc(i) {
        return this.setScroll((i / 100) * this.term.buffer.ybase | 0);
    }

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
            this.term.write("\x1b[H\x1b[J");
            this.term.dispose();
            delete this.term;
            this.term = null;
        }
        if (this.pty instanceof SshPty ) {
            try {
                (this.pty as SshPty).kill( "QUIT" );
                delete this.pty;
            } catch ( e ) {
                log.error( e );
            }
            this.pty = null;
        } else if ( this.pty ) {
            try {
                (this.pty as any).emit("exit", 0);
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
        return this.osc1337 && this.osc1337.CurrentDir;
    }

    @Help( T("Help.TermScrollUp") )
    @Hint({ hint: T("Hint.TermScrollUp"), order: 3 })
    keyScrollUp() {
        this.term.buffer.ydisp += -2;
        if ( this.term.buffer.ydisp < 0 ) {
            this.term.buffer.ydisp = 0;
        }
        this.box.screen.render();
    }

    @Help( T("Help.TermScrollDown") )
    @Hint({ hint: T("Hint.TermScrollDown"), order: 3 })
    keyScrollDown() {
        this.term.buffer.ydisp += 2;
        if ( this.term.buffer.ydisp > this.term.buffer.ybase ) {
            this.term.buffer.ydisp = this.term.buffer.ybase;
        }
        this.box.screen.render();
    }

    @Help( T("Help.TermScrollPageUp") )
    keyScrollPageUp() {
        this.term.buffer.ydisp += -this.term.rows;
        if ( this.term.buffer.ydisp < 0 ) {
            this.term.buffer.ydisp = 0;
        }
        this.box.screen.render();
    }

    @Help( T("Help.TermScrollPageDown") )
    keyScrollPageDown() {
        this.term.buffer.ydisp += this.term.rows;
        if ( this.term.buffer.ydisp > this.term.buffer.ybase ) {
            this.term.buffer.ydisp = this.term.buffer.ybase;
        }
        this.box.screen.render();
    }
}
