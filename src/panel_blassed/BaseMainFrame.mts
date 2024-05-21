/* eslint-disable @typescript-eslint/member-ordering */
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import blessed from "neo-blessed";
import { Widgets } from "neo-blessed";
import { Logger } from "../common/Logger.mjs";
import { BlessedPanel } from "./BlessedPanel.mjs";
import { FuncKeyBox } from "./FuncKeyBox.mjs";
import BottomFilesBox from "./BottomFileBox.mjs";
import { readerControl } from "../panel/readerControl.mjs";
import { Widget } from "./widget/Widget.mjs";
import { keyMappingExec, RefreshType, Hint, TerminalAllowKeys, 
    Help, IHelpService } from "../config/KeyMapConfig.mjs";
import { BlessedMenu } from "./BlessedMenu.mjs";
import { BlessedMcd } from "./BlessedMcd.mjs";
import { BlessedEditor } from "./BlessedEditor.mjs";
import { CommandBox } from "./CommandBox.mjs";
import { exec } from "child_process";
import colors from "colors";
import selection, { Selection, ClipBoard } from "../panel/Selection.mjs";
import { ProgressFunc, ProgressResult, Reader } from "../common/Reader.mjs";
import { messageBox } from "./widget/MessageBox.mjs";
import { ProgressBox } from "./widget/ProgressBox.mjs";
import { StringUtils } from "../common/StringUtils.mjs";
import { Color } from "../common/Color.mjs";
import { inputBox } from "./widget/InputBox.mjs";
import { HintBox } from "./HintBox.mjs";
import { BlessedXterm } from "./BlessedXterm.mjs";
import { T } from "../common/Translation.mjs";
import { draw } from "./widget/BlessedDraw.mjs";
import { File } from "../common/File.mjs";
import { FileReader } from "../panel/FileReader.mjs";
import mainFrame from "./MainFrame.mjs";
import Configure from "../config/Configure.mjs";
import { ColorConfig } from "../config/ColorConfig.mjs";

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pkgjson = require( "../../package.json" );


const log = Logger("MainFrame");

let viewCount = 0;

enum VIEW_TYPE {
    NORMAL = 0,
    VERTICAL_SPLIT = 1,
    HORIZONTAL_SPLIT = 2
}

class ScrLockInfo {
    private _name: string;
    private _widget: Widget;
    private _time: number;

    constructor( name: string, widget: Widget = null ) {
        this._name = name;
        this._widget = widget;
        this._time = Date.now();
    }

    get name() {
        return this._name;
    }

    get widget() {
        return this._widget;
    }

    isTimeOver() {
        return (Date.now() - this._time) > 1000;
    }

    toString() {
        return this._name;
    }

    setFocus() {
        if ( this.widget && this.widget instanceof Widget ) {
            log.debug( "setFocus() - %s", this.name );
            this.widget.setFocus();
        } else {
            log.debug( "NOT Focus !!! - %s", this.name );
        }
    }
}

export abstract class BaseMainFrame implements IHelpService {
    protected screen: Widgets.Screen = null;
    protected viewType: VIEW_TYPE = VIEW_TYPE.NORMAL;
    protected baseWidget = null;
    protected blessedFrames: (BlessedMcd | BlessedPanel | BlessedXterm | BlessedEditor)[] = [];
    protected blessedMenu = null;
    protected funcKeyBox = null;
    protected bottomFilesBox: BottomFilesBox = null;
    protected hintBox = null;
    protected activeFrameNum = 0;
    protected commandBox: CommandBox = null;
    protected keyLockScreenArr: ScrLockInfo[] = [];

    constructor() {}

    viewName() {
        return "Common";
    }

    public hasLock() {
        if ( this.keyLockScreenArr.length === 0 ) {
            return false;
        } else if ( this.keyLockScreenArr.length === 1 ) {
            const lockScreenItem = this.keyLockScreenArr[0];
            if ( lockScreenItem.name === "keyEvent" && lockScreenItem.isTimeOver() ) {
                log.warn( "LOCK TIME OVER - keyLockRelase !!! - focused: %s", (this.screen.focused as any)?._widget);
                this.lockKeyRelease("keyEvent");
                this.blessedFrames[this.activeFrameNum].setFocus();
                return false;
            }
        }
        return true;
    }

    public hasLockAndLastFocus() {
        if ( this.keyLockScreenArr.length > 0 ) {
            process.nextTick( () => {
                this.screen.focusPop();
                this.keyLockScreenArr[0].setFocus();
            });
            return true;
        }
        return false;
    }

    public lockKey(name: string, widget: Widget ) {
        const idx = this.keyLockScreenArr.findIndex( item => item.name === name );
        if ( idx === -1 ) {
            log.info( "Key Lock: %s : %j ", name, this.keyLockScreenArr );
            this.keyLockScreenArr.push( new ScrLockInfo(name, widget) );
        } else {
            log.error( "Already Key Lock: %s : %j", name, this.keyLockScreenArr );
        }
    }

    public lockKeyRelease(name: string) {
        const idx = this.keyLockScreenArr.findIndex( item => item.name === name );
        if ( idx > -1 ) {
            const removedItem = this.keyLockScreenArr.splice(idx, 1);
            log.info( "Key Lock Release: %s : %j", removedItem, this.keyLockScreenArr );
        } else {
            log.error( "Key Lock Relase: - Undefined [%s]", name );
        }
    }

    protected async commandParsing( cmd: string, isInsideTerminal: boolean = false ): Promise<{
        cmd: string;
        ask: boolean;
        prompt: boolean;
        background?: boolean;
        wait?: boolean;
        mterm?: boolean;
        root?: boolean;
        tmpDirRemoveFunc?: () => void;
    }> {
        const result = {
            cmd,
            ask: false,
            prompt: false,
            background: false,
            wait: false,
            mterm: false,
            root: false,
            tmpDirRemoveFunc: null
        };

        if ( cmd ) {
            const panel = this.activePanel();
            isInsideTerminal = isInsideTerminal || cmd.indexOf("%T") > -1;

            if ( panel instanceof BlessedPanel && panel.currentFile() ) {
                const wrap = (text) => {
                    if ( os.platform() === "win32" ) {
                        return `""${text}""`;
                    }
                    return isInsideTerminal ? `${text}` : `"${text}"`;
                };

                let viewerFile = null;
                try {
                    const viewerInfo = await this.getCurrentFileViewer( panel.currentFile() );
                    const { orgFile, tmpFile, endFunc } = viewerInfo || {};
                    viewerFile = tmpFile || orgFile || panel.currentFile();
                    result.tmpDirRemoveFunc = endFunc;
                } catch( e ) {
                    log.error( e );
                }

                /**
                    %1,%F	filename.ext (ex. test.txt)
                    %N 	    filename (ex. test)
                    %E	    file extension name (ex. .ext)
                    %S	    selected files (a.ext b.ext)
                    %A	    current directory name(bin)
                    %D	    execute MCD
                    %Q	    ask before running.
                    %P      command text string edit before a script execution.
                    %W	    Waiting after script execution.
                    %B	    background execution
                    %T      execution over inside terminal
                    %R      root execution - linux, mac osx only (su - --command= )
                    %%	    %
                 */
                result.cmd = result.cmd.replace( /(%[1|F|N|E|S|A|D|Q|P|W|B|T|R])/g, (substr) => {
                    if ( substr.match( /(%1|%F)/ ) ) {
                        return wrap(viewerFile.fullname);
                    } else if ( substr === "%N" ) {
                        return wrap(path.parse(viewerFile.fullname).name);
                    } else if ( substr === "%E" ) {
                        return wrap(viewerFile.extname);
                    } else if ( substr === "%S" ) {
                        return panel.getSelectFiles().map(item => wrap(item.fullname)).join(" ");
                    } else if ( substr === "%A" ) {
                        return wrap(viewerFile.fullname);
                    } else if ( substr === "%%" ) {
                        return "%";
                    } else if ( substr === "%Q" ) {
                        result.ask = true;
                        return "";
                    } else if ( substr === "%B" ) {
                        result.ask = true;
                        return "";
                    } else if ( substr === "%P" ) {
                        result.prompt = true;
                        return "";
                    } else if ( substr === "%W" ) {
                        result.wait = true;
                        return "";
                    } else if ( substr === "%T" ) {
                        result.mterm = true;
                        return "";
                    } else if ( substr === "%R" ) {
                        result.root = true;
                        return "";
                    }
                    return substr;
                });
            }
        }
        log.debug( "commandParsing : %s", cmd );
        return result;
    }

    viewRender() {
        const updateWidget = ( widget: Widget, opt ) => {
            widget.top = opt.top;
            widget.left = opt.left;
            widget.height = opt.height;
            widget.width = opt.width;
            widget.box.emit("resize");
            widget.show();
        };

        const { width, height } = this.baseWidget;
        log.debug( "mainFrame: width [%d] height [%d]", width, height );

        if ( this.viewType === VIEW_TYPE.NORMAL ) {
            const deActiveNum = (this.activeFrameNum + 1) % 2;
            this.blessedFrames[this.activeFrameNum].setBoxDraw(false);
            updateWidget( this.blessedFrames[this.activeFrameNum].getWidget(), { top: 1, left: 0, width: "100%", height: "100%-3" } );
            this.blessedFrames[deActiveNum].hide();
        } else if ( this.viewType === VIEW_TYPE.VERTICAL_SPLIT ) {
            this.blessedFrames[0].setBoxDraw(true);
            this.blessedFrames[1].setBoxDraw(true);
            updateWidget( this.blessedFrames[0].getWidget(), { top: 1, left: 0, width: "50%", height: "100%-3" } );
            updateWidget( this.blessedFrames[1].getWidget(), { top: 1, left: "50%", width: "50%", height: "100%-3" } );
        } else if ( this.viewType === VIEW_TYPE.HORIZONTAL_SPLIT ) {
            this.blessedFrames[0].setBoxDraw(false);
            this.blessedFrames[1].setBoxDraw(false);
            updateWidget( this.blessedFrames[0].getWidget(), { top: 1, left: 0, width: "100%", height: "50%-1" } );
            updateWidget( this.blessedFrames[1].getWidget(), { top: "50%", left: 0, width: "100%", height: "50%-1" } );
        }
        this.blessedFrames[this.activeFrameNum].setFocus();

        if ( this.viewType === VIEW_TYPE.NORMAL && (this.screen.program as any).mouseEnabled ) {
            if (this.activeFocusObj() instanceof BlessedEditor || this.activeFocusObj() instanceof BlessedXterm) {
                this.screen.program.disableMouse();
            }
        } else if ( !(this.screen.program as any).mouseEnabled ) {
            this.screen.program.enableMouse();
        }
    }

    getLastPath() {
        try {
            return fs.readFileSync(os.homedir() + path.sep + ".m" + path.sep + "path", "utf8");
        } catch ( e ) {
            log.error( e );
        }
        return null;
    }

    async start() {
        console.log( blessed );
        this.screen = blessed.screen({
            smartCSR: true,
            fullUnicode: true,
            dockBorders: false,
            useBCE: true,
            ignoreDockContrast: true,
            tabSize: 4,
            // debug: true,
            // dump: true,
            // log: process.env.HOME + "/.m/m2.log"
        });

        this.screen.draw = (start, end) => {
            // log.debug( "draw: %d / %d", start, end );
            draw.call( this.screen, start, end );
        };
        this.screen.enableMouse();

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        this.screen.title = "MDIR.js v" + pkgjson.version;

        this.baseWidget = new Widget( { parent: this.screen, left: 0, top: 0, width: "100%", height: "100%" } );
        this.blessedMenu = new BlessedMenu({ parent: this.baseWidget });
        this.funcKeyBox = new FuncKeyBox( { parent: this.baseWidget } );
        this.bottomFilesBox = new BottomFilesBox( { parent: this.baseWidget } );

        if ( Configure.instance().getOption("supportBgColorTransparent") === false ) {
            this.baseWidget.setColor(ColorConfig.instance().getBaseColor("default"));
        }

        this.blessedFrames = [
            new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ } ),
            new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ } )
        ];

        this.hintBox = new HintBox( { parent: this.baseWidget } );

        const lastPath = this.getLastPath();
        for ( let i = 0; i < this.blessedFrames.length; i++ ) {
            const panel = this.blessedFrames[i];
            if ( panel instanceof BlessedPanel ) {
                panel.setReader(readerControl("file"));
                //panel.getReader().onWatch( (event, filename) => this.onWatchDirectory(event, filename) );
                try {
                    await panel.read( i !== 0 ? (lastPath || ".") : ".", { allowThrow: true } );
                } catch ( e ) {
                    log.error( e );
                    await panel.read( "~" );
                }
            }
        }

        if ( lastPath ) {
            this.viewType = VIEW_TYPE.VERTICAL_SPLIT;
        }
        this.viewRender();

        this.eventStart();
        this.screen.render();
    }

    protected calledTime = Date.now();
    onWatchDirectory( event, filename ) {
        log.debug( "onWatchDirectory [%s] [%s]", event, filename );
        if ( Date.now() - this.calledTime > 1000 ) {
            if ( !this.hasLock() ) {
                process.nextTick( async () => {
                    await this.refreshPromise();
                    this.execRefreshType( RefreshType.ALL );
                    this.calledTime = Date.now();
                });
            }
        }
    }

    eventStart() {
        this.screen.off("keypress", null);
        this.screen.on("keypress", async (ch, keyInfo) => {
            if ( ch === "\u001c" && (global as any).debug ) { // Ctrl + |
                log.error( "force quit !!!" );
                process.exit(0);
                return;
            }

            if ( this.hasLock() ) {
                log.debug( "_keyLockScreen !!! - %s", this.keyLockScreenArr.map( item => item.name ));
                log.debug( "current focus: %s", (this.screen.focused as any)?._widget );
                return;
            }

            if ( this.commandBox ) {
                log.debug( "CommandBox running !!!" );
                return;
            }
            const keyName = keyInfo.full || keyInfo.name;
            log.debug( "KEYPRESS [%s] - START", keyName );

            const panel = this.activeFocusObj();
            if ( !panel.hasFocus() ) {
                log.debug( "Not has FOCUS !!!" );
                this.lockKey("keyEvent", panel);
                return;
            }

            const starTime = Date.now();
            this.lockKey("keyEvent", panel);

            try {
                let searchBoxRefresh: RefreshType = RefreshType.NONE;
                if ( panel instanceof BlessedPanel || panel instanceof BlessedMcd ) {
                    const result = await this.activeFocusObj().keyInputSearchFile(ch, keyInfo);
                    if ( result === 1 ) {
                        this.execRefreshType( RefreshType.OBJECT );
                        return;
                    } else if ( result === -2 ) {
                        searchBoxRefresh = RefreshType.ALL;
                    }
                }

                const keyMappingExecute = async ( func?: () => RefreshType ) => {
                    log.debug( "KEYPRESS - KEY START [%s] - (%dms)", keyInfo.name, Date.now() - starTime );
                    let type: RefreshType;
                    try {
                        let type: RefreshType = await keyMappingExec( panel, keyInfo );
                        if ( type === RefreshType.NONE ) {
                            type = await keyMappingExec( this, keyInfo );
                        }
                        if ( searchBoxRefresh === RefreshType.ALL ) {
                            type = RefreshType.ALL;
                        }
                        if ( type !== RefreshType.NONE ) {
                            this.execRefreshType( type );
                        } else {
                            if ( func ) {
                                type = func();
                                if ( searchBoxRefresh === RefreshType.ALL ) {
                                    type = RefreshType.ALL;
                                }
                                this.execRefreshType( type );
                            }
                        }
                        if ( panel.updateCursor ) {
                            panel.updateCursor();
                        }
                    } catch( e ) {
                        log.error( e );
                        throw e;
                    } finally {
                        log.info( "KEYPRESS - KEY END [%s] - (%dms)", keyInfo.name, Date.now() - starTime );
                    }
                    return type;
                };
                
                if ( panel instanceof BlessedXterm ) {
                    const keyPressFunc = () => {
                        return panel.ptyKeyWrite(keyInfo);
                    };
                    if ( TerminalAllowKeys.indexOf( keyName ) > -1 ) {
                        await keyMappingExecute( keyPressFunc );
                    } else {
                        keyPressFunc();
                        if ( panel.updateCursor ) {
                            panel.updateCursor();
                        }
                    }
                } else if ( panel instanceof BlessedEditor ) {
                    await keyMappingExecute( () => {
                        return panel.keyWrite( keyInfo );
                    });
                } else {
                    await keyMappingExecute();
                }
            } catch ( e ) {
                log.error( "Event Exception: - [%s]", e.stack || e );
                await messageBox( {
                    parent: this.baseWidget,
                    title: T("Error"), 
                    msg: e.stack || e, 
                    textAlign: "left",
                    button: [ T("OK") ] 
                });
            } finally {
                this.lockKeyRelease("keyEvent");
            }
        });
    }

    execRefreshType( type: RefreshType ) {
        if ( type === RefreshType.ALL || type === RefreshType.ALL_NOFOCUS ) {
            log.info( "REFRESH - ALL - START");
            this.screen.realloc();
            this.blessedFrames.forEach( item => {
                if ( item instanceof BlessedPanel ) {
                    item.resetViewCache();
                }
            });
            this.baseWidget.render();
            this.screen.render();
            log.info( "REFRESH - ALL - END");
        } else if ( type === RefreshType.OBJECT || type === RefreshType.OBJECT_NOFOCUS ) {
            log.info( "REFRESH - OBJECT - START");
            this.activeFocusObj().render();
            if ( this.bottomFilesBox ) {
                this.bottomFilesBox.render();
            }
            log.info( "REFRESH - OBJECT - END");
        }
        if ( type === RefreshType.ALL || type === RefreshType.OBJECT ) {
            if ( this.commandBox && !this.commandBox.hasFocus() ) {
                this.commandBox.setFocus();
            } else if ( !this.activeFocusObj().hasFocus() ) {
                this.activeFocusObj().setFocus();
            }
        }
    }

    async refreshPromise() {
        for ( const item of this.blessedFrames ) {
            if ( item instanceof BlessedPanel ) {
                await item.refreshPromise();
            }
        }
        return RefreshType.ALL;
    }

    async sshDisconnect() {
        const activePanel = this.activePanel();
        if ( activePanel instanceof BlessedPanel ) {
            const reader = activePanel.getReader();
            if ( reader ) {
                reader.destory();
            }
            const fileReader = new FileReader();
            // fileReader.onWatch( (event, filename) => this.onWatchDirectory(event, filename) );
            activePanel.setReader( fileReader );
            await activePanel.read(".");
        }
    }

    @Hint({ hint: T("Hint.Split"), order: 2 })
    @Help(T("Help.SplitWindow"))
    split() {
        this.viewType++;
        if ( this.viewType > 2 ) {
            this.viewType = 0;
        }
        log.debug( "split: viewNumber [%d]", (this.viewType as number) );
        this.viewRender();
        return RefreshType.ALL;
    }

    protected abstract archivePromise( file: File, isQuit?: boolean ): Promise<void>;

    protected abstract terminalPromise(isEscape: boolean, shellCmd?: string, sftpReader?: Reader ): Promise<RefreshType>;
    
    @Hint({ hint: T("Hint.Quit"), order: 1, func: () => {
        const readerName = mainFrame().activePanel()?.getReader()?.readerName;
        return readerName === "sftp" ? T("Hint.Disconnect") : T("Hint.Quit");
    }})
    @Help(T("Help.Quit"))
    async quitPromise() {
        const panel = this.activePanel();
        const reader = panel?.getReader();
        const readerName = reader?.readerName;

        if ( readerName === "sftp") {
            const result = await messageBox( { 
                parent: this.baseWidget, 
                title: T("Question"), 
                msg: T("Message.QuitSftp"), 
                button: [ T("OK"), T("Cancel") ] 
            });
            if ( result === T("OK") ) {    
                if ( panel instanceof BlessedXterm ) {
                    await this.terminalPromise( true );
                } else {
                    await this.sshDisconnect();
                }
            }
            return RefreshType.ALL;
        }

        if (readerName === "archive") {
            const file = await reader.rootDir();
            file.name = "..";
            await this.archivePromise(file, true);
            return RefreshType.ALL;
        }

        const result = await messageBox( { 
            parent: this.baseWidget, 
            title: T("Question"), 
            msg: T("Message.QuitProgram"), 
            button: [ T("OK"), T("Cancel") ] 
        });

        if ( result !== T("OK") ) {
            return RefreshType.NONE;
        }

        if (reader && reader.readerName === "file" ) {
            let lastPath = null;
            if ( panel instanceof BlessedXterm ) {
                lastPath = panel.getCurrentPath();
            } else {
                lastPath = (await reader.currentDir()).fullname;
            }
            if ( lastPath && fs.existsSync(lastPath) ) {
                log.debug( "CHDIR : %s", lastPath );
                process.chdir( lastPath );
                try {
                    fs.mkdirSync( os.homedir() + path.sep + ".m", { recursive: true, mode: 0o755 });
                    fs.writeFileSync( os.homedir() + path.sep + ".m" + path.sep + "path", lastPath, { mode: 0o644 } );
                } catch( e ) {
                    log.error( e );
                }
            }
        }
        process.exit(0);
        return RefreshType.NONE;
    }

    @Hint({ hint: T("Hint.NextWindow"), order: 2 })
    @Help( T("Help.NextWindow") )
    nextWindow() {
        if ( this.viewType !== VIEW_TYPE.NORMAL ) {
            this.activeFrameNum++;
            if ( this.blessedFrames.length <= this.activeFrameNum ) {
                this.activeFrameNum = 0;
            }
        } else {
            this.activeFrameNum = 0;
        }
        log.debug( "this.activeFrameNum %d", this.activeFrameNum );
        this.blessedFrames[ this.activeFrameNum ].setFocus();
        this.baseWidget.render();
        return RefreshType.ALL;
    }

    setActivePanel( frame: BlessedPanel | BlessedMcd | BlessedXterm | BlessedEditor ) {
        for ( let i = 0; i < this.blessedFrames.length; i++ ) {
            if ( Object.is( this.blessedFrames[i], frame ) && this.activeFrameNum !== i ) {
                this.activeFrameNum = i;
                this.blessedFrames[ this.activeFrameNum ].setFocus();
                this.baseWidget.render();
                break;
            }
        }
    }

    activePanel(): BlessedPanel | BlessedMcd | BlessedXterm | BlessedEditor {
        return this.blessedFrames[ this.activeFrameNum ];
    }

    activeFocusObj(): any {
        if ( this.blessedMenu && this.blessedMenu.hasFocus() ) {
            return this.blessedMenu;
        }
        return this.activePanel();
    }

    commandBoxShow() {
        const activePanel = this.activePanel();
        if ( !(activePanel instanceof BlessedPanel) ) {
            return RefreshType.NONE;
        }

        /*
        if ( !(activePanel.getReader() instanceof FileReader) ) {
            return RefreshType.NONE;
        }
        */

        if ( this.bottomFilesBox ) {
            this.bottomFilesBox.destroy();
            this.bottomFilesBox = null;
        }

        log.info( "commandBoxShow !!!" );

        this.commandBox = new CommandBox( { parent: this.baseWidget }, this.activePanel() );
        this.commandBox.setFocus();
        this.commandBox.on("blur", () => {
            log.info( "commandBoxShow !!! - blur %s", new Error().stack );
            this.commandBoxClose();
        });

        log.info( "this.commandBox.setFocus !!!" );

        return RefreshType.ALL_NOFOCUS;
    }

    @Help(T("Help.CommandBoxClose"))
    commandBoxClose() {
        if ( this.commandBox ) {
            this.commandBox.destroy();
            this.commandBox = null;
        }
        this.bottomFilesBox = new BottomFilesBox( { parent: this.baseWidget } );
        this.baseWidget.render();
        return RefreshType.ALL;
    }

    @Hint({ hint: T("Hint.ConsoleView") })
    @Help(T("Help.ConsoleView"))
    consoleViewPromise(): Promise<RefreshType> {
        return new Promise( (resolve) => {
            const program = this.screen.program;
            this.lockKey("consoleView", null);
            this.screen.leave();
            program.once( "keypress", async () => {
                this.screen.enter();
                this.screen.enableMouse();
                await this.refreshPromise();
                this.lockKeyRelease("consoleView");
                resolve(RefreshType.ALL);
            });
        });
    }

    commandRun(cmd: string, fileRunMode = false ): Promise<void | RefreshType> {
        const activePanel = this.activePanel();
        if ( !(activePanel instanceof BlessedPanel) ) {
            return new Promise( resolve => resolve() );
        }

        if ( !fileRunMode ) {
            if ( os.platform() === "win32" && cmd.match( /^[a-zA-Z]\:$/ ) ) {
                return activePanel.read(cmd.toUpperCase());
            }

            const cmds = cmd.split(" ");
            if ( cmds[0] === "cd" && cmds[1] ) {
                const chdirPath = cmds[1] === "-" ? activePanel.previousDir : cmds[1];
                if ( cmds[1] === "~" ) {
                    return activePanel.gotoHomePromise();
                }
                return activePanel.read(chdirPath);
            }
        }

        if ( cmd === "quit" || cmd === "exit" ) {
            return this.quitPromise();
        }

        if ( activePanel.getReader().readerName !== "file" ) {
            return new Promise( resolve => resolve() );
        }

        process.chdir( activePanel.currentPath().fullname );

        // eslint-disable-next-line no-async-promise-executor
        return new Promise( async (resolve) => {
            const program = this.screen.program;
            if ( !cmd ) {
                resolve();
                return;
            }

            const cmdParse = await this.commandParsing( cmd );

            this.lockKey("commandRun", null);
            this.screen.leave();
            
            if ( fileRunMode ) {
                cmd = cmdParse.cmd;
                if ( os.platform() !== "win32" ) {
                    if ( cmdParse.background ) {
                        cmd += " &";
                    }
                    if ( os.userInfo().username !== "root" && cmdParse.root ) {
                        cmd = "su - " + cmd;
                    }
                }
            } else {
                if ( process.platform === "win32" ) {
                    cmd = "@chcp 65001 >nul & cmd /d/s/c " + cmdParse.cmd;
                }
            }

            process.stdout.write( colors.white("mdir.js $ ") + cmd + "\n");
            exec(cmd, { encoding: "utf-8" }, (error, stdout, stderr) => {
                if (error) {
                    console.error(error.message);
                } else {
                    stderr && process.stderr.write(stderr);
                    stdout && process.stdout.write(stdout);
                }
                const returnFunc = async () => {
                    if ( cmdParse.tmpDirRemoveFunc ) {
                        cmdParse.tmpDirRemoveFunc();
                    }
                    this.screen.enter();
                    this.screen.enableMouse();
                    await this.refreshPromise();
                    this.lockKeyRelease("commandRun");
                    resolve(RefreshType.ALL);
                };
                if ( !fileRunMode || cmdParse.wait ) {
                    process.stdout.write( colors.yellow(T("Message.ANY_KEY_RETURN_M_JS")) + "\n" );
                    program.once( "keypress", returnFunc );
                } else {
                    returnFunc();
                }
            });
        });
    }

    async methodRun( methodString, param ): Promise<RefreshType> {
        const item = methodString.split(".");
        
        const viewName: string = item[0] || "";
        const methodName = item[1] || "";
        let object = null;
        if ( viewName.toLowerCase() === this.activePanel().viewName().toLowerCase() ) {
            object = this.activePanel();
        } else if ( /common/i.exec(viewName) ) {
            object = this;
        }

        let result = RefreshType.NONE;
        if ( object && object[ (methodName as string) ] ) {
            log.info( "methodRun [%s] - method: [ %s.%s(%s) ]", methodString, object.viewName(), methodName, param ? param.join(",") : "" );

            if ( /(p|P)romise/.exec(methodName as string) ) {
                // eslint-disable-next-line prefer-spread
                result = await object[ (methodName as string) ].apply(object, param);
            } else {
                // eslint-disable-next-line prefer-spread
                result = object[ (methodName as string) ].apply(object, param);
            }
        }
        return result || RefreshType.OBJECT;
    }

    async getCurrentFileViewer( file: File ): Promise<{ orgFile: File; tmpFile: File; endFunc: () => void }> {
        const panel = this.activePanel();
        if ( !panel ) {
            return null;
        }
        if ( !file && panel instanceof BlessedPanel ) {
            file = panel.currentFile();
        }
        if ( !file ) {
            return null;
        }
        const reader = panel.getReader();
        if ( reader instanceof FileReader ) {
            return { orgFile: file, tmpFile: null, endFunc: null };
        }

        const progressBox = new ProgressBox( { title: T("Message.View"), msg: T("Message.Calculating"), cancel: () => {
            reader.isUserCanceled = true;
        }}, { parent: this.baseWidget } );
        this.screen.render();
        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));

        let copyBytes = 0;
        const befCopyInfo = { beforeTime: Date.now(), copyBytes };
        const fullFileSize = 0;
        const refreshTimeMs = 300;

        const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
            copyBytes += chunkLength;
            const repeatTime = Date.now() - befCopyInfo.beforeTime;
            if ( repeatTime > refreshTimeMs ) {
                // const bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                befCopyInfo.beforeTime = Date.now();
                befCopyInfo.copyBytes = copyBytes;
            }
            return reader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
        };
        const result = await reader.viewer(file, progressStatus);
        progressBox.destroy();
        this.screen.render();
        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));
        return result;
    }

    @Hint({ hint: T("Hint.Remove") })
    @Help( T("Help.Remove") )
    async removePromise() {
        const result = await messageBox( { 
            parent: this.baseWidget, 
            title: T("Question"), 
            msg: T("Message.REMOVE_SELECTED_FILES"), 
            button: [ T("OK"), T("Cancel") ] 
        });

        if ( result !== T("OK") ) {
            return RefreshType.NONE;
        }

        const activePanel = this.activePanel();
        if ( !(activePanel instanceof BlessedPanel) ) {
            return RefreshType.NONE;
        }

        const select = new Selection();
        select.set( activePanel.getSelectFiles(), activePanel.currentPath(), ClipBoard.CLIP_NONE, activePanel.getReader() );

        const reader = activePanel.getReader();

        return await this.removeSelectFiles(select, reader);
    }

    async removeSelectFiles( select: Selection, reader: Reader ) {
        reader.isUserCanceled = false;

        const progressBox = new ProgressBox( { title: T("Message.Remove"), msg: T("Message.Calculating"), cancel: () => {
            reader.isUserCanceled = true;
        }}, { parent: this.baseWidget } );
        this.screen.render();
        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));
        
        if ( await select.expandDir() === false ) {
            progressBox.destroy();
            return RefreshType.NONE;
        }

        const files = select.getFiles();
        if ( !files || files.length === 0 ) {
            log.debug( "REMOVE FILES: 0");
            progressBox.destroy();
            return RefreshType.NONE;
        }

        // Sort in filename length descending order.
        files.sort( (a, b) => b.fullname.length - a.fullname.length);

        let beforeTime = Date.now();
        const refreshTimeMs = 300;

        if ( [ "file", "sftp" ].indexOf(reader.readerName) > -1 ) {
            for ( let i = 0; i < files.length; i++ ) {
                const src = files[i];
                try {
                    if ( Date.now() - beforeTime > refreshTimeMs ) {
                        progressBox.updateProgress( src.fullname, `${i+1} / ${files.length}`, i+1, files.length );
                        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));
                        beforeTime = Date.now();
                    }
                    if ( progressBox.getCanceled() ) {
                        break;
                    }
                    await reader.remove( src );
                    log.debug( "REMOVE : [%s]", src.fullname);
                } catch ( err ) {
                    const result2 = await messageBox( {
                        parent: this.baseWidget,
                        title: T("Error"),
                        msg: err,
                        button: [ T("Continue"), T("Cancel") ]
                    });
                    if ( result2 === T("Cancel") ) {
                        break;
                    }
                }
            }
        } else {
            let copyBytes = 0;
            const befCopyInfo = { beforeTime: Date.now(), copyBytes };
            const fullFileSize = 0;

            const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
                copyBytes += chunkLength;
                const repeatTime = Date.now() - befCopyInfo.beforeTime;
                if ( repeatTime > refreshTimeMs ) {
                    // const bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                    const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                    (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                    progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                    befCopyInfo.beforeTime = Date.now();
                    befCopyInfo.copyBytes = copyBytes;
                }
                return reader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
            };
            
            await reader.remove( files, progressStatus );
        }
        progressBox.destroy();
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    @Hint({ hint: T("Hint.Cut"), order: 6 })
    @Help( T("Help.Cut") )
    clipboardCut() {
        const activePanel = this.activePanel();
        if ( !(activePanel instanceof BlessedPanel) ) {
            return ;
        }
        selection().set( activePanel.getSelectFiles(), activePanel.currentPath(), ClipBoard.CLIP_CUT, activePanel.getReader() );
    }

    @Hint({ hint: T("Hint.Copy"), order: 5 })
    @Help( T("Help.Copy") )
    clipboardCopy() {
        const activePanel = this.activePanel();
        if ( !(activePanel instanceof BlessedPanel) ) {
            return ;
        }
        selection().set( activePanel.getSelectFiles(), activePanel.currentPath(), ClipBoard.CLIP_COPY, activePanel.getReader() );
    }

    @Hint({ hint: T("Hint.Paste"), order: 7 })
    @Help( T("Help.Paste") )
    async clipboardPastePromise() {
        const activePanel = this.activePanel();
        const clipSelected = selection();
        
        let files = clipSelected.getFiles();
        if ( !files || files.length === 0 ) {
            log.debug( "CLIPBOARD Length: 0");
            return RefreshType.NONE;
        }

        if ( !(activePanel instanceof BlessedPanel) ) {
            return RefreshType.NONE;
        }

        const targetReader = activePanel.getReader();
        targetReader.isUserCanceled = false;

        const progressBox = new ProgressBox( { 
            title: clipSelected.getClipboard() === ClipBoard.CLIP_CUT ? T("Message.Cut") : T("Message.Copy"), 
            msg: T("Message.Calculating"), 
            cancel: () => {
                targetReader.isUserCanceled = true;
            }
        }, { parent: this.baseWidget } );
        
        this.screen.render();
        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));

        const filesCopyFunc = async (isMove: boolean = false) => {
            files = clipSelected.getFiles();

            // Sort in filename length ascending order.
            files.sort( (a, b) => a.fullname.length - b.fullname.length);

            const fullFileSize = files.reduce( (sum, item) => sum + item.size, 0 );
            const sourceBasePath = clipSelected.getSelecteBaseDir().fullname;

            let copyBytes = 0;
            const befCopyInfo = { beforeTime: Date.now(), copyBytes };
            
            const refreshTimeMs = 300;
            const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
                copyBytes += chunkLength;
                const repeatTime = Date.now() - befCopyInfo.beforeTime;
                if ( repeatTime > refreshTimeMs ) {
                    // const bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                    const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                    (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                    progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                    befCopyInfo.beforeTime = Date.now();
                    befCopyInfo.copyBytes = copyBytes;
                }
                return targetReader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
            };

            if ( activePanel instanceof BlessedPanel ) {
                if ( files[0].dirname === activePanel.currentPath().fullname ) {
                    log.error( "source file and target file are the same." );
                    throw new Error(T("Message.SAME_SOURCE_AND_TARGET"));
                }

                const originalReader = clipSelected.getReader();
                let anotherReader = activePanel.getReader();
                if ( originalReader.readerName !== "file" ) {
                    anotherReader = originalReader;
                } else if ( targetReader.readerName !== "file" ) {
                    anotherReader = targetReader;
                }
                
                log.debug( "READER : [%s] => [%s]", originalReader.readerName, targetReader.readerName );
                if ( [ "file", "sftp" ].indexOf(originalReader.readerName) > -1 && 
                    [ "file", "sftp" ].indexOf(targetReader.readerName) > -1 && 
                    files[0].fstype === clipSelected.getReader().readerName ) {
                    let overwriteAll = false;
                    
                    for ( const src of files ) {
                        if ( progressBox.getCanceled() ) {
                            break;
                        }
                        if ( await originalReader.exist(src.fullname) === false ) {
                            const result = await messageBox( {
                                parent: this.baseWidget,
                                title: T("Error"),
                                msg: T("{{filename}}_FILE_NOT_EXISTS", { filename: src.name }),
                                button: [ T("Skip"), T("Cancel") ]
                            });
                            if ( result === T("Cancel") ) {
                                break;
                            }
                            continue;
                        }

                        const targetBasePath = activePanel.currentPath().fullname;
                        const target = src.clone();

                        let targetName = target.fullname.substr(sourceBasePath.length);
                        if ( originalReader.sep() !== targetReader.sep() ) {
                            if ( originalReader.sep() === "\\" ) {
                                targetName = targetName.replace( /\\/g, targetReader.sep() );
                            } else if ( originalReader.sep() === "/" ) {
                                targetName = targetName.replace( /\//g, targetReader.sep() );
                            }
                        }
                        if ( targetBasePath.substr(targetBasePath.length - 1, targetReader.sep().length) !== targetReader.sep() ) {
                            target.fullname = targetBasePath + targetReader.sep() + targetName;
                        } else {
                            target.fullname = targetBasePath + targetName;
                        }
                        target.fstype = targetReader.readerName;
                        
                        if ( !overwriteAll && await targetReader.exist( target.fullname ) ) {
                            const result = await messageBox( {
                                parent: this.baseWidget,
                                title: T("Copy"),
                                msg: T("Message.{{filename}}_FILE_NOT_EXISTS", { filename: src.name }),
                                button: [ T("Overwrite"), T("Skip"), T("Rename"), T("Overwrite All"), T("Skip All") ]
                            });
                            
                            if ( result === T("Skip") ) {
                                continue;
                            }
                            if ( result === T("Overwrite All") ) {
                                overwriteAll = true;
                            }
                            if ( result === T("Skip All") ) {
                                break;
                            }
                            if ( result === T("Rename") ) {
                                const result = await inputBox( { 
                                    parent: this.baseWidget,
                                    title: T("Rename"),
                                    defaultText: src.name,
                                    button: [ T("OK"), T("Cancel") ]
                                });
                                if ( result && result[1] === T("OK") && result[0] ) {
                                    target.fullname = targetBasePath + targetReader.sep() + result[0];
                                } else {
                                    continue;   
                                }
                            }
                        }

                        try {
                            if ( isMove && clipSelected.getClipboard() === ClipBoard.CLIP_CUT ) {
                                await anotherReader.rename( src, target.fullname, progressStatus );
                            } else {
                                if ( src.dir && !src.link ) {
                                    log.debug( "COPY DIR - [%s] => [%s]", src.fullname, target.fullname );
                                    if ( await targetReader.exist(target.fullname) === false ) {
                                        await targetReader.mkdir( target );
                                    }
                                } else {
                                    log.debug( "COPY - [%s] => [%s]", src.fullname, target.fullname );
                                    if ( anotherReader ) {
                                        await anotherReader.copy( src, null, target, progressStatus );
                                    }
                                }
                            }
                        } catch( err ) {
                            if ( err === "USER_CANCEL" ) {
                                break;
                            } else {
                                throw new Error(`${T("Error")}: ${src.name} - ${err}`);
                            }
                        }
                    }
                } else if ( files[0].fstype === clipSelected.getReader().readerName ) {
                    await anotherReader.copy( files, clipSelected.getSelecteBaseDir(), activePanel.currentPath(), progressStatus );
                }
            }
        };

        if ( clipSelected.getClipboard() === ClipBoard.CLIP_CUT && clipSelected.getReader().readerName === activePanel.getReader().readerName ) {
            try {
                await filesCopyFunc(true);
                log.debug( "FILE CUT - END");
                progressBox.destroy();
                await this.refreshPromise();
                return RefreshType.ALL;
            } catch( err ) {
                log.error( err );
            }
        }

        if ( await clipSelected.expandDir() === false ) {
            log.error( "Expend DIR : FALSE !!!");
            progressBox.destroy();
            return RefreshType.ALL;
        }

        try {
            await filesCopyFunc();
            log.debug( "FILE COPY - END");
        } catch( err ) {
            log.error( "FILE COPY FUNC ERROR - %s", err );
            progressBox.destroy();
            if ( err.message !== "USER_CANCEL" ) {
                await messageBox( {
                    parent: this.baseWidget,
                    title: T("Error"),
                    msg: err.message,
                    button: [ T("OK") ]
                });
            }
            await this.refreshPromise();
            return RefreshType.ALL;
        }

        progressBox.destroy();
        if ( clipSelected.getClipboard() === ClipBoard.CLIP_CUT ) {
            log.debug( "FILE CUT(REMOVE) START");
            await this.removeSelectFiles( clipSelected, clipSelected.getReader() );
        } else {
            await this.refreshPromise();
        }
        return RefreshType.ALL;
    }

    @Help(T("Help.NewFile"))
    async newFilePromise() {
        const panel = this.activePanel();
        if ( panel instanceof BlessedPanel ) {
            const reader = panel.getReader();
            const result = await inputBox( {
                parent: this.baseWidget,
                title: T("Message.CreateEmptyFile"),
                button: [ T("OK"), T("Cancel") ]
            }, {  });
            if ( result && result[1] === T("OK") && result[0] ) {
                
                if ( panel.getReader().readerName !== "file" ) {
                    const progressBox = new ProgressBox( { title: T("Message.CreateEmptyFile"), msg: T("Message.Calculating"), cancel: () => {
                        reader.isUserCanceled = true;
                    }}, { parent: this.baseWidget } );

                    try {
                        const reader = panel.getReader();
                        reader.isUserCanceled = false;

                        this.screen.render();
                        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));

                        let copyBytes = 0;
                        const befCopyInfo = { beforeTime: Date.now(), copyBytes };
                        const fullFileSize = 0;
                        const refreshTimeMs = 100;

                        const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
                            copyBytes += chunkLength;
                            const repeatTime = Date.now() - befCopyInfo.beforeTime;
                            if ( repeatTime > refreshTimeMs ) {
                                // const bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                                const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                                (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                                // + `(${StringUtils.sizeConvert(bytePerSec, false, 1).trim()}s)`;
                                progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                                befCopyInfo.beforeTime = Date.now();
                                befCopyInfo.copyBytes = copyBytes;
                            }
                            return reader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
                        };
                        await reader.newFile( panel.currentPath().fullname + reader.sep() + result[0], progressStatus );
                    } catch( e ) {
                        log.error( e );
                        await messageBox( { parent: this.baseWidget, title: T("Error"), msg: e, button: [ T("OK") ] } );
                    } finally {
                        progressBox.destroy();
                    }
                } else {
                    try {
                        reader.newFile( panel.currentPath().fullname + reader.sep() + result[0], null);
                    } catch( e ) {
                        log.error( e );
                        await messageBox( { parent: this.baseWidget, title: T("Error"), msg: e, button: [ T("OK") ] } );
                    }
                }
            }
        }
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    @Help(T("Help.Mkdir"))
    async mkdirPromise() {
        const panel = this.activePanel();
        if ( panel instanceof BlessedPanel ) {
            const reader = panel.getReader();
            const result = await inputBox( {
                parent: this.baseWidget,
                title: T("Message.MakeDirectory"),
                button: [ T("OK"), T("Cancel") ]
            }, {  });
            if ( result && result[1] === T("OK") && result[0] ) {
                
                if ( panel.getReader().readerName !== "file" ) {
                    const progressBox = new ProgressBox( { title: T("Message.Copy"), msg: T("Message.Calculating"), cancel: () => {
                        reader.isUserCanceled = true;
                    }}, { parent: this.baseWidget } );

                    try {
                        const reader = panel.getReader();
                        reader.isUserCanceled = false;

                        this.screen.render();
                        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));

                        let copyBytes = 0;
                        const befCopyInfo = { beforeTime: Date.now(), copyBytes };
                        const fullFileSize = 0;
                        const refreshTimeMs = 100;

                        const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
                            copyBytes += chunkLength;
                            const repeatTime = Date.now() - befCopyInfo.beforeTime;
                            if ( repeatTime > refreshTimeMs ) {
                                // const bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                                const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                                (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                                // + `(${StringUtils.sizeConvert(bytePerSec, false, 1).trim()}s)`;
                                progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                                befCopyInfo.beforeTime = Date.now();
                                befCopyInfo.copyBytes = copyBytes;
                            }
                            return reader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
                        };
                        await reader.mkdir( panel.currentPath().fullname + reader.sep() + result[0], progressStatus );
                    } catch( e ) {
                        await messageBox( { parent: this.baseWidget, title: T("Error"), msg: e, button: [ T("OK") ] } );
                    } finally {
                        progressBox.destroy();
                    }
                } else {
                    try {
                        reader.mkdir( panel.currentPath().fullname + reader.sep() + result[0], null);
                    } catch( e ) {
                        await messageBox( { parent: this.baseWidget, title: T("Error"), msg: e, button: [ T("OK") ] } );
                    }
                }
            }
        }
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    @Help(T("Help.Rename"))
    async renamePromise() {
        const panel = this.activePanel();
        if ( panel instanceof BlessedPanel ) {
            const reader = panel.getReader();
            const file = panel.currentFile();
            if ( file.dir && file.name === ".." ) {
                return RefreshType.NONE;
            }

            const result = await inputBox( {
                parent: this.baseWidget,
                title: T("Message.Rename"),
                defaultText: file.name,
                button: [ T("OK"), T("Cancel") ]
            }, {  });
            if ( result && result[1] === T("OK") && result[0] ) {
                const progressBox = new ProgressBox( { title: T("Message.Rename"), msg: T("Message.Calculating"), cancel: () => {
                    reader.isUserCanceled = true;
                }}, { parent: this.baseWidget } );

                try {
                    if ( reader.readerName !== "file ") {
                        let copyBytes = 0;
                        const befCopyInfo = { beforeTime: Date.now(), copyBytes };
                        const fullFileSize = 0;
                        const refreshTimeMs = 300;

                        this.screen.render();
                        await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));

                        const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
                            copyBytes += chunkLength;
                            const repeatTime = Date.now() - befCopyInfo.beforeTime;
                            if ( repeatTime > refreshTimeMs ) {
                                // const bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                                const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                                (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                                // + `(${StringUtils.sizeConvert(bytePerSec, false, 1).trim()}s)`;
                                progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                                befCopyInfo.beforeTime = Date.now();
                                befCopyInfo.copyBytes = copyBytes;
                            }
                            return reader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
                        };
                        await reader.rename( file, panel.currentPath().fullname + reader.sep() + result[0], progressStatus );
                    } else {
                        reader.rename( file, panel.currentPath().fullname + reader.sep() + result[0] );
                    }
                    panel.resetViewCache();
                } catch( e ) {
                    await messageBox( { parent: this.baseWidget, title: T("Error"), msg: e, button: [ T("OK") ] } );
                } finally {
                    progressBox.destroy();
                }
            }
        }
        await this.refreshPromise();
        return RefreshType.ALL;
    }
}

