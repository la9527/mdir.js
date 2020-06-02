import { Widget } from './Widget';
import { Widgets, screen } from 'neo-blessed';
import * as unicode from "neo-blessed/lib/unicode";
import * as os from "os";
import * as path from "path";
import { Reader } from "../common/Reader";
import { File } from "../common/File";
import { Logger } from "../common/Logger";
import { IBlessedView } from './IBlessedView';
import mainFrame from './MainFrame';
import { ColorConfig } from '../config/ColorConfig';

const log = Logger("BottomFilesBox");

class CmdHistory {
    private cmdHistory: string[] = [];
    private curPos = -1;

    updatePos() {
        this.curPos = Math.max( this.curPos, 0);
        this.curPos = Math.min( this.cmdHistory.length, this.curPos);
    }

    backend() {
        if ( this.cmdHistory.length === 0 || this.curPos < 0 ) {
            return null;
        }
        this.curPos = this.cmdHistory.length;
        return this.cmdHistory[this.curPos-1];
    }

    front() {
        if ( this.cmdHistory.length === 0 || this.curPos < 0 ) {
            return null;
        }
        this.curPos = 1;
        return this.cmdHistory[this.curPos-1];
    }

    down() {
        if ( this.cmdHistory.length === 0 || this.curPos < 0 ) {
            return null;
        }

        const result = this.cmdHistory[this.curPos-1];
        this.curPos++;
        this.updatePos();
        log.debug( "history down : %d/%d", this.curPos, this.cmdHistory.length );
        return result;
    }

    up() {
        if ( this.cmdHistory.length === 0 || this.curPos < 0 ) {
            return null;
        }
        
        const result = this.cmdHistory[this.curPos-1];
        this.curPos--;
        this.updatePos();
        log.debug( "history up : %d/%d", this.curPos, this.cmdHistory.length );
        return result;
    }

    push( cmd ) {
        if ( this.cmdHistory.length > 0 ) {
            this.cmdHistory = this.cmdHistory.slice(0, this.curPos);
        }
        this.cmdHistory.push( cmd );
        this.curPos = this.cmdHistory.length;
    }
}

const gCmdHistory = new CmdHistory();

export class CommandBox extends Widget {
    private panelView: IBlessedView = null;
    private commandValue: string = "";
    private cursorPos = 0;
    private keylock = false;

    constructor( opts: Widgets.BoxOptions ) {
        super( { left: 0, top: "100%-1", width: "100%", height: 1, input: true, ...opts } );

        const defaultColor = ColorConfig.instance().getBaseColor("mcd");
        this.box.style = defaultColor.blessed;

        this.on("keypress", async (ch, keyinfo) => {
            log.debug( "commandbox [%s] [%j]", ch, keyinfo );
            await this.listener(ch, keyinfo);
            log.debug( "commandbox text - [%s]", this.commandValue );
        });
        this.on("detach", () => {
            log.debug( "detach !!!" );
            this.box.screen.program.hideCursor();
        });
        this.on("render", () => {
            if ( this.box.screen.program.cursorHidden ) {
                this.box.screen.program.showCursor();
            }
        });
        this.box.screen.program.showCursor();
        this.render();
    }

    setPanelView( panelView: IBlessedView ) {
        this.panelView = panelView;
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
            let reader = this.panelView?.getReader();

            let pathInfo = path.parse(pathStr);
            let pathFile = reader?.convertFile( pathInfo.dir );            
            if ( !pathFile ) {
                return [];
            }
            let pathFiles = await reader.readdir( pathFile );
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
        let reader = this.panelView?.getReader();
        let dir: File = reader?.currentDir();

        let promptText = this.prompt( dir?.dirname );
        this.setContentFormat( promptText + this.commandValue );

        this.moveCursor( unicode.strWidth(promptText) + this.cursorPos, 0 );
    }

    updateValue( value ) {
        if ( value !== null ) {
            this.commandValue = value;
            this.cursorPos = Math.max( 0, this.cursorPos );
            this.cursorPos = Math.min( this.commandValue.length, this.cursorPos );
        }
    }

    keyDown() {
        this.updateValue(gCmdHistory.down());
    }

    keyUp() {
        this.updateValue(gCmdHistory.up());
    }

    keyLeft() {
        this.cursorPos = Math.max( 0, --this.cursorPos );
    }

    keyRight() {
        this.cursorPos = Math.min( this.commandValue.length, ++this.cursorPos );
    }

    async keyReturnPromise() {
        gCmdHistory.push( this.commandValue );
        await mainFrame().commandRun( this.commandValue );
        this.updateValue( "" );
        this.box.screen.program.showCursor();
    }

    keyEscape() {
        mainFrame().commandBoxClose();
    }

    keyBackspace() {
        log.debug( "BS - pos:%d", this.cursorPos );
        this.commandValue = this.commandValue.substr(0, this.cursorPos - 1) + this.commandValue.substr(this.cursorPos);
        this.keyLeft();
    }

    keyDelete() {
        log.debug( "DEL - pos:%d", this.cursorPos );
        this.commandValue = this.commandValue.substr(0, this.cursorPos) + this.commandValue.substr(this.cursorPos+1);
    }

    keyHome() {
        this.cursorPos = 0;
    }

    keyEnd() {
        this.cursorPos = this.commandValue.length;
    }

    keyTab() {

    }

    async listener(ch, key) {
        if ( this.keylock ) {
            return;
        }
        this.keylock = true;

        let camelize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, "");
        };

        if ( key?.name ) {
            let methodName = camelize("key " + key.name);
            log.debug( "CommandBox.%s()", methodName );
            if ( this[methodName] ) {
                this[methodName]();
                this.box.screen.render();
                this.keylock = false;
                return;
            } else if ( this[methodName + "Promise"] ) {
                await this[methodName + "Promise"]();
                this.box.screen.render();
                this.keylock = false;
                return;
            }
        }

        if ( ["return", "enter"].indexOf(key.name) > -1 ) {
            // Fix for Windows OS (\r\n)
            this.keylock = false;
            return;
        }

        let value = this.commandValue;
        if ( ch && !/^[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f]$/.test(ch)) {
            this.commandValue = this.commandValue.substr(0, this.cursorPos) + ch + this.commandValue.substr(this.cursorPos);
            this.cursorPos += unicode.strWidth(ch);
        }
        if (this.commandValue !== value) {
            this.box.screen.render();
        }
        this.keylock = false;
    }
}
