import { Widget } from "./widget/Widget.mjs";
import { Widgets } from "neo-blessed";
import unicode from "neo-blessed/lib/unicode.js";
import * as os from "os";
import * as path from "path";
import { File } from "../common/File.mjs";
import { Logger } from "../common/Logger.mjs";
import { IBlessedView } from "./IBlessedView.mjs";
import mainFrame from "./MainFrame.mjs";
import { ColorConfig } from "../config/ColorConfig.mjs";
import { BlessedPanel } from "./BlessedPanel.mjs";
import { RefreshType } from "../config/KeyMapConfig.mjs";
import { FileReader } from "../panel/FileReader.mjs";
import { SftpReader } from "../panel/sftp/SftpReader.mjs";
import { ArchiveReader } from "../panel/archive/ArchiveReader.mjs";

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
    private cursorUpdateFunc = null;

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
        this.cursorUpdateFunc = () => {
            this.curosrUpdate();
        };
        this.screen.on("render", this.cursorUpdateFunc);
        this.panelView = panelView;
    }

    destroy() {
        this.screen.removeListener( "render", this.cursorUpdateFunc);
        this.cursorUpdateFunc = null;
        super.destroy();
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

            const reader = this.panelView && this.panelView.getReader();
            let prompt = ">";
            log.debug( "COMMANDBOX READER: %s", reader);
            if ( reader ) {
                if ( reader instanceof FileReader ) {
                    prompt = os.userInfo().username + "@" + os.hostname().split(".")[0] + ":" + pathStr;
                    if ( os.platform() !== "win32" ) {
                        prompt += os.userInfo().username === "root" ? "# " : "$ ";
                    } else {
                        prompt += ">";
                    }
                } else if ( reader instanceof SftpReader ) {
                    prompt = reader.getConnectInfo() + ":" + pathStr + ">";
                } else if ( reader instanceof ArchiveReader ) {
                    prompt = reader.getBaseArchiveFile().fullname + ":" + pathStr + ">";
                }
            }
            return prompt;
        } catch ( e ) {
            log.error( e );
            return "$ ";
        }
    }

    async pathComplatePromise( pathStr: string ): Promise<{ path: File; files: File[] }> {
        try {
            const reader = this.panelView && this.panelView.getReader();
            if ( !reader ) {
                return null;
            }

            const pathInfo = path.parse(pathStr);
            const isDirCheck = pathStr[ pathStr.length - 1 ] === reader.sep();

            const pathFile = await reader.convertFile( isDirCheck ? pathStr : pathInfo.dir, { checkRealPath: false } );
            if ( !pathFile ) {
                return null;
            }
            const pathFiles = await reader.readdir( pathFile, { noChangeDir: true } );
            return {
                path: pathFile,
                files: pathFiles.filter( (item) => {
                    if ( !isDirCheck && item.name.match(new RegExp("^" + pathInfo.name, "i") ) ) {
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
        const panel = (mainFrame().activePanel() as BlessedPanel);
        if ( panel ) {
            const dir: File = panel.currentPath();
            if ( dir ) {
                //log.debug( "CommandBox - PATH: [%s]", dir.fullname );
                this.promptText = this.prompt( dir.fullname );
                this.setContent( this.promptText + this.commandValue );
            }
        }
    }

    curosrUpdate() {
        // log.debug( "moveCursor : %d", this.cursorPos);
        this.moveCursor( unicode.strWidth(this.promptText) + this.cursorPos, 0 );
        if ( this.box.screen.program.cursorHidden ) {
            this.box.screen.program.showCursor();
        }
    }

    setFocus() {
        super.setFocus();
        this.box.screen.program.showCursor();
        this.render();
    }

    keyDown() {
        const result = gCmdHistory.down();
        if ( result !== null ) {
            this.commandValue = result;
            this.cursorPos = unicode.strWidth(this.commandValue);
        }
    }

    keyUp() {
        const result = gCmdHistory.up();
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
        try {
            await mainFrame().commandRun( this.commandValue );
        } catch( e ) {
            log.error( e );
        }
        this.cursorPos = 0;
        this.commandValue = "";
        mainFrame().execRefreshType(RefreshType.ALL_NOFOCUS);
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
            const reader = this.panelView && this.panelView.getReader();
            const sep = reader ? reader.sep() : path.sep;
            const cmd = this.commandValue;
            const lastIndex = cmd.lastIndexOf(" ");
            const firstText = cmd.substr(0, lastIndex > -1 ? (lastIndex + 1) : cmd.length );
            const lastPath = cmd.substr(lastIndex+1);
            const currentPath: File = (mainFrame().activePanel() as BlessedPanel).currentPath();

            if ( this.tabFileInfo ) {
                this.tabFileInfo.index++;
                if ( this.tabFileInfo.files.length <= this.tabFileInfo.index ) {
                    this.tabFileInfo.index = 0;
                }
            } else if ( currentPath ) {
                const { path: curpath, files } = await this.pathComplatePromise( currentPath.fullname + (lastPath ? (sep + lastPath) : "") );
                if ( files && files.length > 0 ) {
                    this.tabFileInfo = { path: curpath, files, index: 0 };
                } else {
                    this.tabFileInfo = null;
                }
            }

            if ( this.tabFileInfo ) {
                const pathInfo = path.parse(lastPath);
                const tabFile = this.tabFileInfo.files[this.tabFileInfo.index];
                this.commandValue = firstText + (pathInfo.dir ? (pathInfo.dir + sep) : "") + tabFile.name + (tabFile.dir ? sep : "");
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

        const camelize = (str) => {
            return str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
                return index === 0 ? word.toLowerCase() : word.toUpperCase();
            }).replace(/\s+/g, "");
        };

        if ( key && key.name ) {
            if ( key.name !== "tab" ) {
                this.tabFileInfo = null;
            }

            const methodName = camelize("key " + key.name);
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

        const value = this.commandValue;
        // eslint-disable-next-line no-control-regex
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
