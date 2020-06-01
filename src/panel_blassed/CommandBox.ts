import { Widget } from './Widget';
import { Widgets } from 'neo-blessed';
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

    listener(ch, key) {
        let done; // = this._done;
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
          done(null, null);
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
