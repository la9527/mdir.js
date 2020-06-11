import { Widget } from "./widget/Widget";
import { Widgets } from "neo-blessed";
import * as Term from "term.js";
import NodePTY, { IPty } from "node-pty";

export class Terminal extends Widget {
    options: Widgets.TerminalElement | any;
    shell: string;
    args: string[];

    handler: any;
    cursor: string;
    cursorBlink: string;
    screenKeys: string;
    termName: string;

    term: any = null;
    title: string;
    pty: IPty = null;

    constructor( options: Widgets.TerminalElement | any ) {
        super( { ...options, scrollable: false } );

        // XXX Workaround for all motion
        if (this.screen.program.tmux && this.screen.program.tmuxVersion >= 2) {
            this.screen.program.enableMouse();
        }

        this.handler = options.handler;
        this.shell = options.shell || process.env.SHELL || 'sh';
        this.args = options.args || [];

        this.cursor = this.options.cursor;
        this.cursorBlink = this.options.cursorBlink;
        this.screenKeys = this.options.screenKeys;

        this.termName = options.terminal
                || options.term
                || process.env.TERM
                || 'xterm';

        this.bootstrap();
    }

    bootstrap() {
        const element = {
            // window
            get document() { return element; },
            navigator: { userAgent: 'node.js' },
        
            // document
            get defaultView() { return element; },
            get documentElement() { return element; },
            createElement: function() { return element; },
        
            // element
            get ownerDocument() { return element; },
            addEventListener: function() {},
            removeEventListener: function() {},
            getElementsByTagName: function() { return [element]; },
            getElementById: function() { return element; },
            parentNode: null,
            offsetParent: null,
            appendChild: function() {},
            removeChild: function() {},
            setAttribute: function() {},
            getAttribute: function() {},
            style: {},
            focus: function() {},
            blur: function() {},
            console: console
        };
        
        element.parentNode = element;
        element.offsetParent = element;
        
        this.term = Term({
            termName: this.termName,
            cols: (this.box.width as number) - (this.box.iwidth as number),
            rows: (this.box.height as number) - (this.box.iheight as number),
            context: element,
            document: element,
            body: element,
            parent: element,
            cursorBlink: this.cursorBlink,
            screenKeys: this.screenKeys
        });
        
        this.term.refresh = () => {
            this.screen.render();
        };
        
        this.term.keyDown = () => {};
        this.term.keyPress = () => {};
        
        this.term.open(element);
        
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
        this.screen.program.input.on('data', (data) => {
            this._onData(data);
        });
        
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
        
        this.on('focus', () => {
            this.term.focus();
        });
        
        this.on('blur', () => {
            this.term.blur();
        });
        
        this.term.on('title', (title) => {
            this.title = title;
            this.box.emit('title', title);
        });
        
        this.term.on('passthrough', (data) => {
            this.screen.program.flush();
            (this.screen.program as any)._owrite(data);
        });
        
        this.on('resize', () => {
            process.nextTick(() => {
                this.term.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
            });
        });
        
        this.box.once('render', () => {
            this.term.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
        });
        
        this.on('destroy', () => {
            this.kill();
            this.screen.program.input.removeListener('data', ( data ) => {
                this._onData( data );
            });
        });
        
        if (this.handler) {
            return;
        }
        
        this.pty = NodePTY.spawn(this.shell, this.args, {
            name: this.termName,
            cols: (this.width as number) - (this.box.iwidth as number),
            rows: (this.height as number) - (this.box.iheight as number),
            cwd: process.env.HOME,
            env: this.options.env || process.env
        });
        
        this.on('resize', () => {
            process.nextTick(() => {
                try {
                    this.pty.resize((this.width as number) - (this.box.iwidth as number), (this.height as number) - (this.box.iheight as number));
                } catch (e) {
                    ;
                }
            });
        });
        
        this.handler = (data) => {
            this.pty.write(data);
            this.screen.render();
        };
        
        this.pty.on('data', (data) => {
            this.write(data);
            this.screen.render();
        });
        
        this.pty.on('exit', (code) => {
            this.box.emit('exit', code || null);
        });
        
        this.box.onScreenEvent('keypress', () => {
            this.screen.render();
        });
        
        (this.screen as any)._listenKeys(this);
    }

    _onData(data) {
        if (this.screen.focused === this.box && !(this.box as any)._isMouse(data)) {
          this.handler(data);
        }
    }

    write(data) {
        return this.term.write(data);
    }
      
    render() {
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
      
        var scrollback = this.term.lines.length - (yl - yi);
      
        for (var y = Math.max(yi, 0); y < yl; y++) {
          var line = screen.lines[y];
          if (!line || !this.term.lines[scrollback + y - yi]) break;
      
          if (y === yi + this.term.y
              && this.term.cursorState
              && screen.focused === this
              && (this.term.ydisp === this.term.ybase || this.term.selectMode)
              && !this.term.cursorHidden) {
            cursor = xi + this.term.x;
          } else {
            cursor = -1;
          }
      
          for (var x = Math.max(xi, 0); x < xl; x++) {
            if (!line[x] || !this.term.lines[scrollback + y - yi][x - xi]) break;
      
            line[x][0] = this.term.lines[scrollback + y - yi][x - xi][0];
      
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
      
            line[x][1] = this.term.lines[scrollback + y - yi][x - xi][1];
      
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
        this.term.ydisp = offset;
        return this.box.emit('scroll');
    }

    scrollTo(offset) {
        this.term.ydisp = offset;
        return this.box.emit('scroll');
    }

    getScroll() {
        return this.term.ydisp;
    }

    scroll(offset) {
        this.term.scrollDisp(offset);
        return this.term.emit('scroll');
    }

    resetScroll() {
        this.term.ydisp = 0;
        this.term.ybase = 0;
        return this.box.emit('scroll');
    };

    getScrollHeight() {
        return this.term.rows - 1;
    };

    getScrollPerc() {
        return (this.term.ydisp / this.term.ybase) * 100;
    };

    setScrollPerc(i) {
        return this.setScroll((i / 100) * this.term.ybase | 0);
    };

    screenshot(xi, xl, yi, yl) {
        xi = 0 + (xi || 0);
        if (xl != null) {
          xl = 0 + (xl || 0);
        } else {
          xl = this.term.lines[0].length;
        }
        yi = 0 + (yi || 0);
        if (yl != null) {
          yl = 0 + (yl || 0);
        } else {
          yl = this.term.lines.length;
        }
        return this.screen.screenshot(xi, xl, yi, yl, this.term);
    }
    
    kill() {
        if (this.pty) {
            this.pty.kill();
        }
        this.term.refresh = function() {};
        this.term.write('\x1b[H\x1b[J');
        if ( this.term._blink ) {
            clearInterval(this.term._blink);
        }
        this.term.destroy();
    }
}