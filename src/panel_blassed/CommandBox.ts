import { Widget } from './Widget';
import { Widgets, screen } from 'neo-blessed';
import unicode from "neo-blessed/lib/unicode";
import * as os from "os";
import * as path from "path";
import { Reader } from "../common/Reader";
import { File } from "../common/File";
import { Logger } from "../common/Logger";

const log = Logger("BottomFilesBox");

export class CommandBox extends Widget {
    private reader: Reader = null;
    private value: string = "";

    constructor( opts: Widgets.BoxOptions ) {
        super( { ...opts, top: "100%", left: 0, width: '100%', height: 1, input: true } );

        this.on("keypress", async (ch, keyinfo) => {
            await this.listener(ch, keyinfo);
        });

        this.on('resize', (get) => { 
            this._updateCursor(get) 
        });
        this.on('move', (get) => {
            this._updateCursor(get) 
        });
    }

    setReader( reader ) {
        this.reader = reader;
    }

    prompt( pathStr ) {
        try {
            let prompt = os.userInfo().username + "@" + os.hostname().split(".")[0] + ":" + pathStr;
            prompt += os.userInfo().username !== "root" ? "# " : "$ ";
            return prompt;
        } catch ( e ) {
            log.error( e );
            return "$ ";
        }
    }

    async pathComplatePromise( pathStr ): Promise<File[]> {
        try {
            let pathInfo = path.parse(pathStr);
            let pathFile = this.reader.convertFile( pathInfo.dir );
            
            let pathFiles = await this.reader.readdir( pathFile );
            return pathFiles.filter( (item) => {
                if ( item.name.indexOf(pathInfo.name) > -1 ) {
                    return true;
                }
                return false;
            });
        } catch( e ) {
            log.error( e );
            return [];
        }
    }

    draw() {
        this.setContent( "" );
    }

    _updateCursor(get) {
        const screen: Widgets.Screen = this.box.screen;
        if (screen.focused !== this.box) {
          return;
        }
        const box: any = this.box;
        const lpos = get ? box.lpos : box._getCoords();
        if (!lpos) return;
      
        let last = box._clines[box._clines.length - 1]
          , program = screen.program
          , line
          , cx
          , cy;
      
        // Stop a situation where the textarea begins scrolling
        // and the last cline appears to always be empty from the
        // _typeScroll `+ '\n'` thing.
        // Maybe not necessary anymore?
        if (last === '' && this.value[this.value.length - 1] !== '\n') {
            last = box._clines[box._clines.length - 2] || '';
        }
      
        line = Math.min(
            box._clines.length - 1 - (box.childBase || 0),
            (lpos.yl - lpos.yi) - box.iheight - 1);
      
        // When calling clearValue() on a full textarea with a border, the first
        // argument in the above Math.min call ends up being -2. Make sure we stay
        // positive.
        line = Math.max(0, line);
      
        cy = lpos.yi + box.itop + line;
        cx = lpos.xi + box.ileft + box.strWidth(last);
      
        // XXX Not sure, but this may still sometimes
        // cause problems when leaving editor.
        if (cy === program.y && cx === program.x) {
            return;
        }
      
        if (cy === program.y) {
            if (cx > program.x) {
                program.cuf(cx - program.x);
            } else if (cx < program.x) {
                program.cub(program.x - cx);
            }
        } else if (cx === program.x) {
            if (cy > program.y) {
                program.cud(cy - program.y);
            } else if (cy < program.y) {
                program.cuu(program.y - cy);
            }
        } else {
            program.cup(cy, cx);
        }
    }

    listener(ch, key) {
        let value = this.value;
      
        if (key.name === 'return') return;
        if (key.name === 'enter') {
          ch = '\n';
        }
      
        // TODO: Handle directional keys.
        if (key.name === 'left' || key.name === 'right'
            || key.name === 'up' || key.name === 'down') {
          ;
        }
      
        if (key.name === 'escape') {
            this.box.emit("done", null, null);
        } else if (key.name === 'backspace') {
            if (this.value.length) {
                if (this.box.screen.fullUnicode) {
                    if (unicode.isSurrogate(this.value, this.value.length - 2)) {
                        this.value = this.value.slice(0, -2);
                    } else {
                        this.value = this.value.slice(0, -1);
                    }
                } else {
                    this.value = this.value.slice(0, -1);
                }
            }
        } else if ( key.name === "tab" ) {
            
        } else if (ch) {
          if (!/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
            this.value += ch;
          }
        }
      
        if (this.value !== value) {
          this.box.screen.render();
        }
    }
}
