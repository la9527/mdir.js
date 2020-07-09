import { Widget } from './widget/Widget';
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
        this.curPos = Math.min( this.cmdHistory.length - 1, this.curPos);
    }

    end() {
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
        if ( this.curPos === this.cmdHistory.length - 1 ) {
            return "";
        }
        const result = this.cmdHistory[++this.curPos];
        log.debug( "history down : [%s] [%d/%d]", result, this.curPos, this.cmdHistory.length );
        this.updatePos();
        return result;
    }

    up() {
        if ( this.cmdHistory.length === 0 || this.curPos < 0) {
            return null;
        }
        
        const result = this.cmdHistory[this.curPos--];
        this.updatePos();
        log.debug( "history up : [%s] [%d/%d]", result, this.curPos, this.cmdHistory.length );
        return result;
    }

    push( cmd ) {
        if ( this.cmdHistory.length > 0 && this.curPos !== this.cmdHistory.length - 1 ) {
            this.cmdHistory = this.cmdHistory.slice(0, this.curPos);
        }
        this.cmdHistory.push( cmd );
        this.curPos = this.cmdHistory.length - 1;

        log.debug( "history push : [%s] [%d/%d]", cmd, this.curPos, this.cmdHistory.length );
    }
}

const gCmdHistory = new CmdHistory();

export class CommandBox extends Widget {
    private panelView: IBlessedView = null;
    private promptText: string = "";
    private commandValue: string = "";
    private cursorPos = 0;
    private keylock = false;

    constructor( opts: Widgets.BoxOptions, panelView: IBlessedView ) {
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
            this.afterRender();
            if ( this.box.screen.program.cursorHidden ) {
                this.box.screen.program.showCursor();
            }
        });
        this.panelView = panelView;
    }

    setPanelView( panelView: IBlessedView ) {
        this.panelView = panelView;
    }

    prompt( pathStr ) {
        try {
            const MAX_PATH_SIZE = 50;
            let path = pathStr;
            if ( path.length > (this.width as number) - MAX_PATH_SIZE ) {
                path = "..." + path.substr(MAX_PATH_SIZE-3);
            }

            let prompt = os.userInfo().username + "@" + os.hostname().split(".")[0] + ":" + pathStr;
            if ( os.platform() !== "win32" ) {
                prompt += os.userInfo().username === "root" ? "# " : "$ ";
            } else {
                prompt += ">";
            }
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
            let pathFiles = await reader.readdir( pathFile, { noChangeDir: true } );
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
        let dir: File = this.panelView?.getReader()?.currentDir();
        if ( dir ) {
            this.promptText = this.prompt( dir?.dirname );
            this.setContent( this.promptText + this.commandValue );
        }
    }

    afterRender() {
        // log.debug( "moveCursor : %d", this.cursorPos);
        this.moveCursor( unicode.strWidth(this.promptText) + this.cursorPos, 0 );
    }

    setFocus() {
        super.setFocus();
        this.box.screen.program.showCursor();
        this.render();
    }

    keyDown() {
        let result = gCmdHistory.down();
        if ( result !== null ) {
            this.commandValue = result;
            this.cursorPos = unicode.strWidth(this.commandValue);
        }
    }

    keyUp() {
        let result = gCmdHistory.up();
        if ( result !== null ) {
            this.commandValue = result;
            this.cursorPos = unicode.strWidth(this.commandValue);
        }
    }

    keyLeft() {
        this.cursorPos = Math.max( 0, --this.cursorPos );
    }

    keyRight() {
        this.cursorPos = Math.min( unicode.strWidth(this.commandValue), ++this.cursorPos );
    }

    async keyReturnPromise() {
        gCmdHistory.push( this.commandValue );
        await mainFrame().commandRun( this.commandValue );
        this.cursorPos = 0;
        this.commandValue = "";
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
        this.cursorPos = unicode.strWidth(this.commandValue);
    }

    // TODO: Need Implementation - tab key to search a matching files.
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
