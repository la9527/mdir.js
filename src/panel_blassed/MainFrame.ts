import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, screen } from "neo-blessed";
import { Logger } from "../common/Logger";
import { BlessedPanel } from './BlessedPanel';
import { FuncKeyBox } from './FuncKeyBox';
import BottomFilesBox from "./BottomFileBox";
import { readerControl } from '../panel/readerControl';
import { Widget } from "./widget/Widget";
import { keyMappingExec, menuKeyMapping, KeyMappingInfo, KeyMapping, RefreshType } from "../config/KeyMapConfig";
import { menuConfig } from "../config/MenuConfig";
import { BlessedMenu } from "./BlessedMenu";
import { BlessedMcd } from './BlessedMcd';
import { CommandBox } from './CommandBox';
import { exec } from "child_process";
import * as colors from "colors";
import selection, { Selection, ClipBoard } from "../panel/Selection";
import { ProgressFunc } from "../common/Reader";
import { messageBox } from "./widget/MessageBox";
import { ProgressBox } from "./widget/ProgressBox";
import { StringUtils } from "../common/StringUtils";
import { Color } from "../common/Color";
import { resolve } from "dns";

const log = Logger("MainFrame");

let gMainFrame = null;

let viewCount = 0;

enum VIEW_TYPE {
    NORMAL = 0,
    VERTICAL_SPLIT = 1,
    HORIZONTAL_SPLIT = 2
}

@KeyMapping( KeyMappingInfo.Common, "Common" )
export class MainFrame {
    private screen: Widgets.Screen = null;
    private viewType: VIEW_TYPE = VIEW_TYPE.NORMAL;
    private baseWidget = null;
    private blessedFrames = [];
    private blessedMenu = null;
    private funcKeyBox = null;
    private bottomFilesBox: BottomFilesBox = null;
    private activeFrameNum = 0;
    private commandBox: CommandBox = null;
    public keyLock = false;
    private _keyLockScreen = false;

    constructor() {
        menuKeyMapping( KeyMappingInfo, menuConfig );
    }

    async mcdPromise(isEscape = false) {
        let view: BlessedPanel | BlessedMcd = this.blessedFrames[this.activeFrameNum];
        if ( view instanceof BlessedPanel ) {
            view.destroy();

            const newView = new BlessedMcd( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader(), view.currentPath() );
            await newView.scanDir( view.currentPath() );
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedMcd ) {
            view.destroy();

            const newView = new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
            await newView.read( isEscape ? view.firstScanPath : view.currentPathFile());
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        }
        this.viewRender();
        this.baseWidget.render();
    }

    viewRender() {
        const updateWidget = ( widget: Widget, opt ) => {
            widget.top = opt.top;
            widget.left = opt.left;
            widget.height = opt.height;
            widget.width = opt.width;
            widget.show();
        };

        let { width, height } = this.baseWidget.width;

        log.debug( "mainFrame: width [%d] height [%d]", width, height );

        if ( this.viewType === VIEW_TYPE.NORMAL ) {
            this.activeFrameNum = 0;
            updateWidget( this.blessedFrames[0].getWidget(), { top: 1, left: 0, width: "100%", height: "100%-4" } );
            this.blessedFrames[1].hide();
            this.blessedFrames[0].setFocus();
        } else if ( this.viewType === VIEW_TYPE.VERTICAL_SPLIT ) {
            updateWidget( this.blessedFrames[0].getWidget(), { top: 1, left: 0, width: "50%", height: "100%-4" } );
            updateWidget( this.blessedFrames[1].getWidget(), { top: 1, left: "50%", width: "50%", height: "100%-4" } );
        } else if ( this.viewType === VIEW_TYPE.HORIZONTAL_SPLIT ) {
            updateWidget( this.blessedFrames[0].getWidget(), { top: 1, left: 0, width: "100%", height: "50%-1" } );
            updateWidget( this.blessedFrames[1].getWidget(), { top: "50%", left: 0, width: "100%", height: "50%-1" } );
        }
    }

    async start() {
        this.screen = blessed.screen({
            smartCSR: true,
            fullUnicode: true,
            dockBorders: false,
            useBCE: true,
            ignoreDockContrast: true,
            debug: false,
            // dump: true,
            // log: process.env.HOME + "/.m/m2.log"
        });
        
        this.baseWidget = new Widget( { parent: this.screen, left: 0, top: 0, width: "100%", height: "100%" } );
        this.blessedMenu = new BlessedMenu({ parent: this.baseWidget });

        this.funcKeyBox = new FuncKeyBox( { parent: this.baseWidget }  );
        this.bottomFilesBox = new BottomFilesBox( { parent: this.baseWidget } );

        this.blessedFrames = [
            new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ } ),
            new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ } )
        ];

        for ( var i = 0; i < this.blessedFrames.length; i++ ) {
            try {
                this.blessedFrames[i].setReader(readerControl("file"));
                await this.blessedFrames[i].read( "." );
            } catch ( e ) {
                log.error( e );
            }
        }

        this.viewRender();

        this.screen.key("q", () => {
            process.exit(0);
        });

        this.eventStart();
        this.blessedFrames[0].setFocus();
        this.screen.render();
    }

    eventStart() {
        this.screen.off('keypress');
        this.screen.on('keypress', async (ch, keyInfo) => {
            if ( this._keyLockScreen ) {
                return;
            }
            if ( this.keyLock ) {
                log.debug( "keyLock !!!");
                return;
            }
            if ( this.commandBox ) {
                log.debug( "CommandBox running !!!" );
                return;
            }

            log.info( "KEYPRESS [%s] - START", keyInfo.name );

            let starTime = Date.now();
            this._keyLockScreen = true;

            let type: RefreshType = await keyMappingExec( this.activeFocusObj(), keyInfo );
            if ( type === RefreshType.NONE ) {
                type = await keyMappingExec( this, keyInfo );
            }
            this.execRefreshType( type );
            log.info( "KEYPRESS [%s] - (%dms)", keyInfo.name, Date.now() - starTime );
            this._keyLockScreen = false;
        });
    }

    execRefreshType( type: RefreshType ) {
        if ( type === RefreshType.ALL ) {
            log.info( "REFRESH - ALL");
            this.screen.realloc();
            this.blessedFrames.forEach( item => item.resetViewCache() );
            this.baseWidget.render();
            this.screen.render();
        } else if ( type === RefreshType.OBJECT ) {
            log.info( "REFRESH - OBJECT");
            this.activeFocusObj().render();
        }
    };

    async refreshPromise() {
        this.screen.realloc();
        for ( let item of this.blessedFrames ) {
            if ( item instanceof BlessedPanel ) {
                await item.refresh();
            }
        }
        this.screen.render();
    }

    split() {
        this.viewType++;
        if ( this.viewType > 2 ) {
            this.viewType = 0;
        }
        log.debug( "split: viewNumber [%d]", (this.viewType as number) );
        this.viewRender();
        return RefreshType.ALL;
    }

    quit() {
        process.exit(0);
    }

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

    activePanel(): BlessedPanel {
        // log.debug( "activePanel %d", this.activeFrameNum );
        return this.blessedFrames[ this.activeFrameNum ];
    }

    activeFocusObj(): any {
        if ( this.blessedMenu && this.blessedMenu.hasFocus() ) {
            return this.blessedMenu;
        }
        return this.activePanel();
    }

    menu() {
        this.menuClose();

        let viewName = this.activeFocusObj().viewName || "Common";
        log.debug( "menuConfig[ viewName ] !!!", viewName, menuConfig[ viewName ] );
        this.blessedMenu.init();
        this.blessedMenu.setMainMenuConfig( menuConfig[ viewName ] );
        this.blessedMenu.setFocus();
        return RefreshType.ALL;
    }

    menuClose() {
        log.debug( "menuClose !!!" );
        this.blessedMenu.close();
        return RefreshType.ALL;
    }

    commandBoxShow() {
        if ( this.bottomFilesBox ) {
            this.bottomFilesBox.destroy();
            this.bottomFilesBox = null;
        }

        this.commandBox = new CommandBox( { parent: this.baseWidget }, this.activePanel() );
        this.commandBox.setFocus();
        return RefreshType.ALL;
    }

    commandBoxClose() {
        if ( this.commandBox ) {
            this.commandBox.destroy();
            this.commandBox = null;
        }
        this.bottomFilesBox = new BottomFilesBox( { parent: this.baseWidget } );
        this.baseWidget.render();
        return RefreshType.ALL;
    }

    consoleView(): Promise<void> {
        return new Promise( (resolve, reject) => {
            let program = this.screen.program;
            this.screen.leave();
            program.once( 'keypress', async () => {
                this.screen.enter();
                await this.refreshPromise();
                resolve();
            });
        });
    }

    commandRun(cmd): Promise<void> {
        let cmds = cmd.split(" ");
        if ( cmds[0] === "cd" && cmds[1] ) {
            let chdirPath = cmds[1] === "-" ? this.activePanel().previousDir : cmds[1];
            return this.activePanel().read(chdirPath);
        }

        return new Promise( (resolve, reject) => {
            let program = this.screen.program;
            if ( !cmd ) {
                resolve();
                return;
            }

            if ( cmd === "quit" || cmd === "exit" ) {
                process.exit(0);
            }

            this.screen.leave();
            
            process.stdout.write( colors.white("m.js $ ") + cmd + "\n");

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(error.message);
                } else {
                    stderr && process.stderr.write(stderr);
                    stdout && process.stdout.write(stdout);
                }
                console.log( colors.white("Press any key to return m.js") );
                program.once( 'keypress', async () => {
                    this.screen.enter();
                    await this.refreshPromise();
                    resolve();
                });
            });
        });
    }

    async methodRun( methodString, param ): Promise<RefreshType> {
        let item = methodString.split(".");
        
        let className = item[0] || "";
        let methodName = item[1] || "";
        let object = null;
        if ( /panel/i.exec(className) ) {
            object = this.activePanel();
        } else if ( /common/i.exec(className) ) {
            object = this;
        }

        let result = RefreshType.NONE;
        if ( object && object[ (methodName as string) ] ) {
            if ( /(p|P)romise/.exec(methodName as string) ) {
                result = await object[ (methodName as string) ].apply(object, param);
            } else {
                result = object[ (methodName as string) ].apply(object, param);
            }
        }
        return result || RefreshType.OBJECT;
    }

    async removePromise() {
        let result = await messageBox( { title: "Question", msg: "Do you want to delete the selected files?", button: [ "OK", "Cancel" ] }, { parent: this.baseWidget } );
        if ( result === "Cancel" ) {
            return RefreshType.NONE;
        }

        let select = new Selection();
        select.set( this.activePanel().getSelectFiles(), this.activePanel().currentPath(), ClipBoard.CLIP_NONE );

        const reader = this.activePanel().getReader();
        await select.expandDir( reader );

        let files = select.getFiles();
        if ( !files || files.length === 0 ) {
            log.debug( "REMOVE FILES: 0");
            return RefreshType.NONE;
        }

        // Sort in filename length descending order.
        files.sort( (a, b) => b.fullname.length - a.fullname.length);

        for ( let src of files ) {
            try {
                log.debug( "REMOVE : [%s]", src.fullname);
                await reader.remove( src );
            } catch ( err ) {
                let result = await messageBox( {
                    title: "Remove Error",
                    msg: err,
                    button: [ "Continue", "Cancel" ]
                }, { parent: this.baseWidget });
                if ( result === "Cancel" ) {
                    break;
                }
            }
        }
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    clipboardCut() {
        selection().set( this.activePanel().getSelectFiles(), this.activePanel().currentPath(), ClipBoard.CLIP_CUT );
    }

    clipboardCopy() {
        selection().set( this.activePanel().getSelectFiles(), this.activePanel().currentPath(), ClipBoard.CLIP_COPY );
    }

    async clipboardPastePromise() {
        const activePanel = this.activePanel();
        const clipSelected = selection();
        
        let files = clipSelected.getFiles();
        if ( !files || files.length === 0 ) {
            log.debug( "CLIPBOARD Length: 0");
            return RefreshType.NONE;
        }

        const progressBox = new ProgressBox( { title: "Copy", msg: "Calculating...", cancel: () => {
            activePanel.getReader().isUserCanceled = true;
        }}, { parent: this.baseWidget } );
        this.screen.render();
        await new Promise( (resolve) => setTimeout( () => resolve(), 1 ));
        
        if ( await clipSelected.expandDir( activePanel.getReader() ) === false ) {
            return RefreshType.NONE;
        }
        
        files = clipSelected.getFiles();

        // Sort in filename length ascending order.
        files.sort( (a, b) => a.fullname.length - b.fullname.length);

        const fullFileSize = files.reduce( (sum, item) => sum + item.size, 0 );
        const sourceBasePath = clipSelected.getSelecteBaseDir().fullname;

        let copyBytes = 0;
        let befCopyInfo = { beforeTime: Date.now(), copyBytes };
        
        let refreshTimeMs = 300;
        const progressStatus: ProgressFunc = ( source, copySize, size, chunkLength ) => {
            copyBytes += chunkLength;
            let repeatTime = Date.now() - befCopyInfo.beforeTime;
            if ( repeatTime > refreshTimeMs ) {
                let bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                let lastText = (new Color(3, 0)).fontHexBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + "/" + 
                                (new Color(3, 0)).fontHexBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                                // + `(${StringUtils.sizeConvert(bytePerSec, false, 1).trim()}s)`;
                progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                befCopyInfo.beforeTime = Date.now();
                befCopyInfo.copyBytes = copyBytes;
            }
        };

        if ( activePanel instanceof BlessedPanel ) {
            if ( files[0].dirname === activePanel.currentPath().fullname ) {
                log.error( "source file and target file are the same." );
                progressBox.destroy();
                await messageBox( { title: "ERROR", msg: "source and target directory are the same.", button: [ "OK" ] }, { parent: this.baseWidget } );
                return RefreshType.NONE;
            }
            
            const reader = activePanel.getReader();
            log.debug( "READER : [%s] => [%s]", reader.readerName, files[0].fstype );
            if ( reader.readerName === files[0].fstype ) {
                let targetPath = activePanel.currentPath();
                let i = 0, skipAll = false, overwriteAll = false;
                for ( let src of files ) {
                    if ( progressBox.getCanceled() ) {
                        break;
                    }
                    if ( !reader.exist(src.fullname) ) {
                        let result = await messageBox( {
                            title: "ERROR",
                            msg: `'${src.name}' file NOT exists. What would you do want?`,
                            button: [ "Skip", "Cancel" ]
                        }, { parent: this.baseWidget });
                        if ( result === "Cancel" ) {
                            break;
                        }
                        continue;
                    }

                    let targetBasePath = activePanel.currentPath().fullname;

                    let target = src.clone();
                    target.fullname = targetBasePath + target.fullname.substr(sourceBasePath.length);
                    
                    if ( !overwriteAll && reader.exist( target.fullname ) ) {
                        let result = await messageBox( {
                            title: "Copy",
                            msg: `'${src.name}' file exists. What would you do want?`,
                            button: [ "Overwrite", "Skip", "Rename", "Overwrite All", "Skip All" ]
                        }, { parent: this.baseWidget });
                        
                        if ( result === "Skip" ) {
                            continue;
                        }
                        if ( result === "Overwrite All") {
                            overwriteAll = true;
                        }
                        if ( result === "Skip All") {
                            break;
                        }
                        if ( result === "Rename" ) {
                            // TODO !!!
                            continue;
                        }
                    }

                    try {
                        if ( src.dir ) {
                            log.debug( "COPY DIR - [%s] => [%s]", src.fullname, target.fullname );
                            reader.mkdir( target );
                        } else {
                            log.debug( "COPY - [%s] => [%s]", src.fullname, target.fullname );
                            await reader.copy( src, target, progressStatus );
                        }
                    } catch( err ) {
                        let result = await messageBox( {
                            title: "Copy",
                            msg: "ERROR: " + err,
                            button: [ "OK", "Cancel" ]
                        }, { parent: this.baseWidget });
                        if ( result === "Cancel" ) {
                            break;
                        }
                    } finally {
                        log.debug( "Copy - [%s]", src.fullname );
                    }
                }
            }
        }

        progressBox.destroy();
        await this.refreshPromise();
        return RefreshType.ALL;
    }

    static instance() {
        if ( !gMainFrame ) {
            gMainFrame = new MainFrame();
        }
        return gMainFrame;
    }
}

export default function mainFrame(): MainFrame {
    return MainFrame.instance();   
}
