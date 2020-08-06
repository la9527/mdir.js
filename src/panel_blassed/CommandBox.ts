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
import { BlessedPanel } from './BlessedPanel';
import { RefreshType } from '../config/KeyMapConfig';

const log = Logger("CommandBox");

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
    private tabFilesView: number = -1;
    private tabFileInfo: {
        path: File;
        index: number;
        files: File[];
    } = null;
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

    async pathComplatePromise( pathStr ): Promise<{ path: File, files: File[] }> {
        try {
            let reader = this.panelView && this.panelView.getReader();
            if ( !reader ) {
                return null;
            }

            let pathInfo = path.parse(pathStr);
            let pathFile = reader.convertFile( pathInfo.dir, { checkRealPath: true } );
            if ( !pathFile ) {
                return null;
            }
            let pathFiles = await reader.readdir( pathFile );
            return {
                path: pathFile,
                files: pathFiles.filter( (item) => {
                    if ( item.name.match(new RegExp("^" + pathInfo.name, "i") ) ) {
                        return true;
                    }
                    return false;
                })
            };
        } catch( e ) {
            log.error( e.stack );
            return null;
        }
    }

    draw() {
        let panel = (mainFrame().activePanel() as BlessedPanel);
        if ( panel ) {
            let dir: File = panel.currentPath();
            if ( dir ) {
                //log.debug( "CommandBox - PATH: [%s]", dir.fullname );
                this.promptText = this.prompt( dir.fullname );
                this.setContent( this.promptText + this.commandValue );
            }
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
        mainFrame().execRefreshType(RefreshType.ALL);
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

    async keyTabPromise() {
        try {
            let cmd = this.commandValue;
            let lastIndex = cmd.lastIndexOf(" ");
            let firstText = cmd.substr(0, lastIndex > -1 ? (lastIndex + 1) : cmd.length );
            let lastPath = cmd.substr(lastIndex+1);
            let currentPath: File = (mainFrame().activePanel() as BlessedPanel).currentPath();

            if ( this.tabFileInfo ) {
                this.tabFileInfo.index++;
                if ( this.tabFileInfo.files.length <= this.tabFileInfo.index ) {
                    this.tabFileInfo.index = 0;
                }
            } else if ( currentPath ) {
                const { path: curpath, files } = await this.pathComplatePromise( currentPath.fullname + (lastPath ? (path.sep + lastPath) : "") );
                if ( files && files.length > 0 ) {
                    this.tabFileInfo = { path: curpath, files, index: 0 };
                } else {
                    this.tabFileInfo = null;
                }
            }

            if ( this.tabFileInfo ) {
                let pathInfo = path.parse(lastPath);
                this.commandValue = firstText + (pathInfo.dir ? (pathInfo.dir + path.sep) : "") + this.tabFileInfo.files[this.tabFileInfo.index].name;
                this.cursorPos = unicode.strWidth(this.commandValue);
            }
        } catch( e ) {
            log.debug( e.stack );
        }
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

        if ( key && key.name ) {
            if ( key.name !== "tab" ) {
                this.tabFileInfo = null;
            }

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
