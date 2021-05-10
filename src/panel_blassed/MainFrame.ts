/* eslint-disable @typescript-eslint/member-ordering */
import which from "which";
import * as os from "os";
import * as fs from "fs";
import { Logger } from "../common/Logger";
import { BlessedPanel } from "./BlessedPanel";
import { menuKeyMapping, KeyMappingInfo, 
    KeyMapping, RefreshType, Hint,  
    Help, getHelpInfo, IHelpInfo, IHelpService } from "../config/KeyMapConfig";
import { menuConfig } from "../config/MenuConfig";
import { BlessedMcd } from "./BlessedMcd";
import { BlessedEditor } from "./BlessedEditor";
import colors from "colors";
import { IMountList, ProgressFunc, ProgressResult, Reader, } from "../common/Reader";
import { messageBox, MSG_BUTTON_TYPE } from "./widget/MessageBox";
import { StringUtils } from "../common/StringUtils";
import { BlessedXterm } from "./BlessedXterm";
import { sprintf } from "sprintf-js";
import { T } from "../common/Translation";
import { ImageViewBox } from "./widget/ImageBox";
import { File } from "../common/File";
import { BaseMainFrame } from "./BaseMainFrame";
import { ConnectionManager } from "./widget/ConnectionManager";
import { ArchiveReader } from "../panel/archive/ArchiveReader";
import { FileReader } from "../panel/FileReader";
import { ArchiveZip } from "../panel/archive/ArchiveZip";
import { ArchiveTarGz } from "../panel/archive/ArchiveTarGz";
import { Color } from "../common/Color";
import { ProgressBox } from "./widget/ProgressBox";
import { inputBox } from "./widget/InputBox";
import { Selection, ClipBoard } from "../panel/Selection";
import { SftpReader, IConnectionInfo } from "../panel/sftp/SftpReader";

const log = Logger("MainFrame");

let viewCount = 0;

export default function mainFrame(): MainFrame {
    return MainFrame.instance();
}

@KeyMapping( KeyMappingInfo.Common )
export class MainFrame extends BaseMainFrame implements IHelpService {
    constructor() {
        super();
        menuKeyMapping( KeyMappingInfo, menuConfig );
    }

    @Hint({ hint: T("Hint.Terminal"), order: 4, func: () => {
        return (mainFrame().activePanel() instanceof BlessedXterm) ? T("Hint.TerminalExit") : T("Hint.Terminal");
    }})
    @Help(T("Help.Terminal"))
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async terminalPromise(isEscape = false, shellCmd: string = null, sftpReader: Reader = null ): Promise<RefreshType> {
        const view = this.blessedFrames[this.activeFrameNum];        
        const result = await this.commandParsing( shellCmd, true );
        const shell = result.cmd ? result.cmd.split(" ") : null;

        if ( view instanceof BlessedPanel ) {
            view.destroy();

            const newView = new BlessedXterm( { 
                parent: this.baseWidget, 
                cursor: "line",
                cursorBlink: true,
                screenKeys: false,
                shell: shell ? shell[0] : null,
                args: shell ? shell.splice(1) : null,
                viewCount: viewCount++ 
            }, sftpReader || view.getReader() );
            newView.on("process_exit", () => {
                process.nextTick( () => {
                    result.tmpDirRemoveFunc && result.tmpDirRemoveFunc();
                    this.terminalPromise( true );
                });
            });
            newView.on("error", (err) => {
                process.nextTick( async () => {
                    await messageBox( {
                        parent: this.baseWidget,
                        title: T("ERROR"),
                        msg: err + " - " + shellCmd,
                        button: [ T("OK") ]
                    });

                    result.tmpDirRemoveFunc && result.tmpDirRemoveFunc();                    
                    await this.terminalPromise( true );
                });
            });
            newView.bootstrap(sftpReader ? null : view.currentPath());
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedMcd ) {
            view.destroy();

            const newView = new BlessedXterm( { 
                parent: this.baseWidget,
                viewCount: viewCount++,
                cursor: "block",
                cursorBlink: true,
                screenKeys: false,
                shell: shell ? shell[0] : null,
                args: shell ? shell.splice(1) : null,
            }, view.getReader() );
            newView.on("process_exit", () => {
                process.nextTick( () => {
                    this.terminalPromise( true );
                });
            });
            newView.on("error", (e) => {
                process.nextTick( async () => {
                    await messageBox( { 
                        parent: this.baseWidget, 
                        title: T("Error"), 
                        msg: e, 
                        button: [ T("OK") ] 
                    });
                    this.terminalPromise( true );
                });
            });
            newView.bootstrap(view.currentPathFile());
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedXterm ) {
            let reader = view.getReader();
            if ( reader instanceof SftpReader && !reader.isSFTPSession() && !isEscape ) {
                const result = await messageBox( { 
                    parent: this.baseWidget, 
                    title: T("Question"), 
                    msg: T("Message.QuitSftp"), 
                    button: [ T("OK"), T("Cancel") ] 
                });
                if ( result === T("OK") ) {    
                    return await this.terminalPromise(true);
                }
                return RefreshType.OBJECT;
            }
            view.destroy();

            let readPath: any = ".";
            if ( reader instanceof SftpReader && !reader.isSFTPSession() ) {
                reader = new FileReader();
            } else {
                readPath = view.getCurrentPath() || await reader.currentDir() || ".";
            }
            log.warn( "READ PATH : %s", readPath );
            const newView = new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ }, reader );
            await newView.read( readPath );
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        }
        this.viewRender();
        this.baseWidget.render();
        return RefreshType.ALL;
    }

    async archivePromise(file: File = null, isQuit: boolean = false) {
        const view = this.blessedFrames[this.activeFrameNum];
        if ( !file && view instanceof BlessedPanel ) {
            file = view.currentFile();
        }
        if ( !file ) {
            return;
        }

        const resetArchiveInfo = async () => {
            if ( view instanceof BlessedPanel ) {
                (view as any).tmpDirRemoveFunc && (view as any).tmpDirRemoveFunc();
                (view as any).tmpDirRemoveFunc = null;

                const fileReader = new FileReader();
                // fileReader.onWatch( (event, filename) => this.onWatchDirectory(event, filename) );
                if ( view.getReader() ) {
                    view.getReader().destory();
                }
                view.setReader( fileReader );

                if ( file.fstype === "file" ) {
                    const filePath = await fileReader.convertFile( file.dirname );
                    await view.read( filePath );
                    view.focusFile( file );
                } else if ( file.fstype === "archive" ) {
                    const archiveFile = await fileReader.convertFile( file.root, { checkRealPath: true } );
                    const archivePath = await fileReader.convertFile( archiveFile.dirname );
                    log.debug( "ARCHIVE PATH: [%s]", archivePath );
                    await view.read( archivePath );
                    log.debug( "ARCHIVE PATH: [%s]", archivePath );
                    view.focusFile( archiveFile );
                }
            }
        };

        if ( view instanceof BlessedPanel && file.fstype === "file" ) {
            const result = await this.getCurrentFileViewer( file );
            const { orgFile, tmpFile, endFunc } = result || {};
            const viewerFile = tmpFile || orgFile || file;

            const reader = new ArchiveReader();
            const progressBox = new ProgressBox( { title: T("Message.Archive"), msg: T("Message.Calculating"), cancel: () => {
                reader.isUserCanceled = true;
            }}, { parent: this.baseWidget } );
            this.screen.render();
            await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));
            
            let copyBytes = 0;
            const befCopyInfo = { beforeTime: Date.now(), copyBytes };
        
            const refreshTimeMs = 100;
            const fullFileSize = file.size;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const progressStatus: ProgressFunc = ( source, processSize, size, chunkLength ) => {
                copyBytes = processSize;
                const repeatTime = Date.now() - befCopyInfo.beforeTime;
                if ( repeatTime > refreshTimeMs ) {
                    // let bytePerSec = Math.round((copyBytes - befCopyInfo.copyBytes) / repeatTime) * 1000;
                    const lastText = (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(copyBytes, false, 1).trim()) + " / " + 
                                    (new Color(3, 0)).fontBlessFormat(StringUtils.sizeConvert(fullFileSize, false, 1).trim());
                    progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
                    befCopyInfo.beforeTime = Date.now();
                    befCopyInfo.copyBytes = copyBytes;
                }
                return reader.isUserCanceled ? ProgressResult.USER_CANCELED : ProgressResult.SUCCESS;
            };

            try {
                if ( endFunc ) {
                    (view as any).tmpDirRemoveFunc = endFunc;
                }

                if ( await reader.setArchiveFile( viewerFile, progressStatus ) ) {
                    if ( view.getReader() ) {
                        view.getReader().destory();
                    }
                    view.setReader( reader );
                    await view.read( await reader.rootDir() );
                    view.setFocus();
                    view.resetPosition();
                }
                progressBox.destroy();
            } catch( err ) {
                progressBox.destroy();
                await messageBox({
                    parent: this.baseWidget,
                    title: T("Error"),
                    msg: err.message,
                    button: [ T("OK") ]
                });
                await resetArchiveInfo();
            }
        } else if ( 
            view instanceof BlessedPanel && 
            file.fstype === "archive" && 
            (await view.getReader().currentDir()).fullname === "/" &&
            file.fullname === "/" && file.name === ".." ) {
            await resetArchiveInfo();
        } else if ( isQuit ) {
            await resetArchiveInfo();
        }
    }

    async createArchiveFilePromise(): Promise<RefreshType> {
        const activePanel = this.activePanel();
        let selectFiles = [];
        if ( activePanel instanceof BlessedPanel ) {
            selectFiles = activePanel.getSelectFiles();
        } else {
            return RefreshType.NONE;
        }

        const reader = activePanel.getReader();
        const selection = new Selection();
        selection.set( selectFiles, activePanel.currentPath(), ClipBoard.CLIP_COPY, reader );
        await selection.expandDir();
        
        const files = selection.getFiles();
        if ( !files || files.length === 0 ) {
            return RefreshType.NONE;
        }

        const archiveType = await messageBox({
            parent: this.baseWidget,
            title: T("Archive"),
            msg: T("What archive one would you choose?"),
            button: [ "ZIP", "TAR.GZ", "TAR.XZ" ]
        });
        if ( !archiveType ) {
            return RefreshType.NONE;
        }

        let name = files[0].name;
        if ( archiveType === "ZIP" ) {
            name += ".zip";
        } else if ( archiveType === "TAR.GZ" ) {
            name += ".tar.gz";
        } else if ( archiveType === "TAR.XZ" ) {
            name += ".tar.xz";
        }
        const result = await inputBox( { 
            parent: this.baseWidget,
            title: T("Archive File"),
            defaultText: name,
            button: [ T("OK"), T("Cancel") ]
        });

        if ( result && result[1] === T("OK") && result[0] ) {
            const progressBox = new ProgressBox( { title: T("Message.Archive"), msg: T("Message.Calculating"), cancel: () => {
                reader.isUserCanceled = true;
            }}, { parent: this.baseWidget } );
            this.screen.render();
            await new Promise<void>( (resolve) => setTimeout( () => resolve(), 1 ));
            
            let copyBytes = 0;
            const befCopyInfo = { beforeTime: Date.now(), copyBytes };
        
            const refreshTimeMs = 100;
            const fullFileSize = selection.getExpandSize();
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const progressStatus: ProgressFunc = ( source, processSize, size, chunkLength ) => {
                copyBytes = processSize;
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

            try {
                const targetFile = await reader.convertFile( activePanel.currentPath().fullname + reader.sep() + result[0], { virtualFile: true } );
                log.debug( "ORIGINAL SOURCE : [%s]", JSON.stringify(files.map( item => item.toString() ), null, 2) );
                if ( archiveType === "ZIP" ) {
                    await new ArchiveZip().compress( files, activePanel.currentPath(), targetFile, progressStatus );
                    await activePanel.refreshPromise();
                    return RefreshType.ALL;
                } else if ( archiveType === "TAR.GZ" || archiveType === "TAR.XZ" ) {
                    await new ArchiveTarGz().compress( files, activePanel.currentPath(), targetFile, progressStatus );
                    await activePanel.refreshPromise();
                    return RefreshType.ALL;
                }
            } catch( e ) {
                log.error( e );
                await messageBox( {
                    parent: this.baseWidget,
                    title: T("ERROR"),
                    msg: e.stack,
                    textAlign: "left",
                    scroll: true,
                    button: [ T("OK") ]
                });
                return RefreshType.ALL;
            } finally {
                progressBox.destroy();
            }
        }
        return RefreshType.NONE;
    }

    @Help(T("Help.Editor"))
    async editorPromise(file: File = null) {
        const view = this.blessedFrames[this.activeFrameNum];
        if ( view instanceof BlessedPanel ) {
            try {
                const result = await this.getCurrentFileViewer( file );
                const { orgFile, tmpFile, endFunc } = result || {};
                const viewerFile = tmpFile || orgFile || file;

                log.info( "EDITOR: [%s] [%s]", viewerFile, file );

                view.destroy();

                const newView = new BlessedEditor( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
                newView.setFocus();
                this.blessedFrames[this.activeFrameNum] = newView;

                if ( endFunc ) {
                    (newView as any).tmpDirRemoveFunc = endFunc;
                }
                await newView.load( viewerFile );
            } catch ( e ) {
                log.error( "[%s][%s]", e, e?.stack );
                await messageBox({                    
                    parent: this.baseWidget,
                    title: T("Error"),
                    msg: T("Message.FILE_OPEN_FAILURE") + "\n" + e.message,
                    button: [ T("OK") ]
                });
                return await this.editorPromise();
            }
        } else if ( view instanceof BlessedEditor ) {
            (view as any).tmpDirRemoveFunc && (view as any).tmpDirRemoveFunc();
            (view as any).tmpDirRemoveFunc = null;
            view.destroy();

            const newView = new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
            await newView.read( await view.getReader().currentDir() || "." );
            newView.setFocus();
            newView.focusFile( view.getFile() );
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedXterm || view instanceof BlessedEditor ) {
            return RefreshType.NONE;
        }
        this.viewRender();
        this.baseWidget.render();
        return RefreshType.ALL;
    }

    @Hint({ hint: T("Hint.Mcd") })
    @Help(T("Help.Mcd"))
    async mcdPromise(isEscape = false) {
        const view = this.blessedFrames[this.activeFrameNum];
        if ( view instanceof BlessedPanel ) {
            view.destroy();

            const newView = new BlessedMcd( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader(), view.currentPath() );
            await newView.load();
            await newView.scanDir( view.currentPath() );
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedMcd ) {
            view.destroy();

            const newView = new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
            await newView.read( isEscape ? view.firstScanPath : view.currentPathFile());
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedXterm ) {
            return RefreshType.NONE;
        }
        this.viewRender();
        this.baseWidget.render();
        return RefreshType.ALL;
    }

    async vimPromise() {
        try {
            const result = await which("vim");
            if ( result ) {
                log.debug( result );
                await this.terminalPromise( false, "vim %1" );
            }
        } catch ( e ) {
            log.error( e );
            await messageBox({
                parent: this.baseWidget,
                title: T("Error"),
                msg: T("Message.VIM_NOT_EXECUTED"),
                button: [ T("OK") ]
            });
        }
    }
    
    @Hint({ hint: T("Hint.Menu"), order: 3 })
    @Help(T("Help.Menu"))
    menu() {
        const activePanel = this.activePanel();
        if ( (activePanel instanceof BlessedXterm) ) {
            return RefreshType.NONE;
        }
        const viewName = this.activeFocusObj().viewName() || "Common";
        if ( !menuConfig[ viewName ] ) {
            return RefreshType.NONE;
        }
        this.menuClose();
        
        log.debug( "menuConfig[ viewName ] !!!", viewName, menuConfig[ viewName ] );

        this.blessedMenu.init();
        this.blessedMenu.setMainMenuConfig( menuConfig[ viewName ] );
        this.blessedMenu.setFocus();
        return RefreshType.ALL;
    }

    menuClose() {
        const activePanel = this.activePanel();
        if ( (activePanel instanceof BlessedXterm) ) {
            return RefreshType.NONE;
        }
        log.debug( "menuClose !!!" );
        this.blessedMenu.close();
        return RefreshType.ALL;
    }

    @Help(T("Help.PanelSync"))
    async panelSyncPromise() {
        const activePanel = this.activePanel();
        const anotherPanel = this.blessedFrames.find( (item, i) => {
            return item instanceof BlessedPanel && item.getReader().readerName === "file" && this.activeFrameNum !== i;
        });
        if ( activePanel.getReader().readerName === "file" && activePanel instanceof BlessedPanel && anotherPanel instanceof BlessedPanel ) {
            await activePanel.read(anotherPanel.currentPath());
            return RefreshType.ALL;
        }
        return RefreshType.NONE;
    }

    
    aboutPromise(): Promise<RefreshType> {
        return new Promise( (resolve) => {
            setTimeout( async () => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const version = require("../../package.json").version;
                await messageBox( {
                    parent: this.baseWidget,
                    title: "Mdir.js - v" + version,
                    msg: T("About", { joinArrays: "\n" }),
                    textAlign: "left",
                    button: [ T("OK") ]
                });
                resolve( RefreshType.ALL );
            }, 100);
        });
    }
    
    @Hint({ hint: T( (os.platform() === "win32" ? "Hint.DriveList" : "Hint.MountList")), order: 7 })
    @Help( T(os.platform() === "win32" ? "Help.DriveList" : "Help.MountList") )
    async mountListPromise() {
        const panel = this.activePanel();
        if ( panel instanceof BlessedPanel || panel instanceof BlessedMcd ) {
            const mountList: IMountList[] = await panel.getReader().mountList();
            if ( mountList ) {
                mountList.sort( (a, b) => {
                    if ( a.mountPath.fullname > b.mountPath.fullname ) return 1;
                    if ( b.mountPath.fullname > a.mountPath.fullname ) return -1;
                    return 0;
                });

                const maxLength = [ 0, 0, 0 ];
                mountList.forEach( (a) => {
                    maxLength[0] = Math.max( maxLength[0], StringUtils.strWidth(a.mountPath.fullname) );
                    maxLength[1] = Math.max( maxLength[1], StringUtils.strWidth(a.device) );
                    maxLength[2] = Math.max( maxLength[2], StringUtils.strWidth(a.description) );
                });

                const fillText = ( text, fillSize ) => {
                    const textSize = StringUtils.strWidth(text);
                    if ( textSize < fillSize ) {
                        return text + Array(fillSize - textSize).fill(" ").join("");
                    }
                    return text;
                };

                const viewMountInfo = mountList.map( (item) => {
                    if ( item.size ) {
                        return sprintf("%s {gray-fg}|{/gray-fg} %s {gray-fg}|{/gray-fg} %s {gray-fg}|{/gray-fg} %s", fillText(item.mountPath.fullname, maxLength[0]), fillText(item.device, maxLength[1]), fillText(item.description, maxLength[2]), StringUtils.sizeConvert(item.size, true));
                    } else {
                        return sprintf("%s {gray-fg}|{/gray-fg} %s {gray-fg}|{/gray-fg} %s", fillText(item.mountPath.fullname, maxLength[0]), fillText(item.device, maxLength[1]), fillText(item.description, maxLength[2]) );
                    }
                });

                log.debug( viewMountInfo );

                try {
                    const result = await messageBox({
                        parent: this.baseWidget, 
                        title: os.platform() === "win32" ? T("Message.DriveList") : T("Message.MountList"), 
                        msg: "", 
                        textAlign: "left",
                        button: viewMountInfo, 
                        buttonType: MSG_BUTTON_TYPE.VERTICAL,
                        buttonTextAlign: "left"
                    });
                    if ( result && viewMountInfo.indexOf(result) > -1 ) {
                        if ( panel instanceof BlessedPanel ) {
                            await panel.read( mountList[ viewMountInfo.indexOf(result) ].mountPath );
                        } else {
                            panel.getReader().changeDir( mountList[ viewMountInfo.indexOf(result) ].mountPath );
                            await panel.rescan(2);
                        }
                        return RefreshType.ALL;
                    }
                } catch ( e ) {
                    log.error( e );
                }
            }
        }
        return RefreshType.NONE;
    }

    @Help(T("Help.Help"))
    async helpPromise() {
        const helpInfo: IHelpInfo = getHelpInfo();
        let viewText = [];
        for ( const frame of [ "Common", "Panel", "Mcd", "XTerm" ] ) {
            viewText.push(`${T(frame)})` );

            const subText = [];
            for ( const item in helpInfo[frame] ) {
                if ( helpInfo[frame][item].humanKeyName ) {
                    subText.push( sprintf("{yellow-fg}%14s{/yellow-fg} : %s", helpInfo[frame][item].humanKeyName, helpInfo[frame][item].text ) );
                }
            }
            subText.sort();
            
            viewText = viewText.concat( subText );
            viewText.push( "" );
        }

        log.debug( "viewText: %s", viewText );

        return new Promise( (resolve) => {
            setTimeout( async () => {
                await messageBox( {
                    parent: this.baseWidget,
                    title: T("HELP"),
                    msg: viewText.join("\n"),
                    textAlign: "left",
                    scroll: true,
                    button: [ T("OK") ]
                });
                resolve( RefreshType.ALL );
            }, 100);
        });
    }

    async imageViewPromise( file: File ) {
        const result  = await this.getCurrentFileViewer( file );
        const { orgFile, tmpFile, endFunc } = result || {};
        const viewerFile = tmpFile || orgFile || file;

        if (process.env.TERM_PROGRAM === "iTerm.app") {
            const buffer = await fs.promises.readFile(viewerFile.fullname);

            const iTermImage = (buffer, options: { width?: number | string; height?: number | string; preserveAspectRatio?: boolean } = {}) => {
                const OSC = "\u001B]";
                const BEL = "\u0007";
                let ret = `${OSC}1337;File=inline=1`;            
                if (options.width) {
                    ret += `;width=${options.width}`;
                }
            
                if (options.height) {
                    ret += `;height=${options.height}`;
                }
            
                if (options.preserveAspectRatio === false) {
                    ret += ";preserveAspectRatio=0";
                }
            
                return ret + ":" + buffer.toString("base64") + BEL;
            };

            await new Promise<void>( (resolve) => {
                const program = this.screen.program;
                this.screen.leave();
                process.stdout.write( iTermImage(buffer, { height: "95%" }) );
                process.stdout.write( "\n" + colors.white(T("Message.ANY_KEY_RETURN_M_JS")) + "\n" );
                program.once( "keypress", () => {
                    resolve();
                });
            });
            endFunc && endFunc();
            this.screen.enter();
            this.screen.enableMouse();
            await this.refreshPromise();
            this.execRefreshType( RefreshType.ALL );
        } else {
            setTimeout( async () => {
                const imageViewBox = new ImageViewBox( { parent: this.baseWidget } );
                this.screen.render();
                await imageViewBox.setImageOption({
                    file: viewerFile,
                    closeFunc: async () => {
                        log.debug( "CLOSE !!!");
                        endFunc && endFunc();
                        this.execRefreshType( RefreshType.ALL );
                    }
                });
                this.screen.render();
            }, 100);
        }
    }

    async connectionManagerPromise() {
        const reader = this.activePanel()?.getReader();
        if ( reader && reader instanceof SftpReader ) {
            const result = await messageBox( { 
                parent: this.baseWidget, 
                title: T("Question"), 
                msg: T("Message.QuitSftp"), 
                button: [ T("OK"), T("Cancel") ] 
            });
            if ( result === T("OK") ) {    
                if ( this.activePanel() instanceof BlessedXterm ) {
                    return await this.terminalPromise( true );
                }
                return await this.sshDisconnect();
            }
            return RefreshType.NONE;
        }

        const refreshNextTick = (connectionInfo: IConnectionInfo = null) => {
            process.nextTick( async () => {
                this.activePanel().setFocus();
                if ( connectionInfo ) {
                    await this.ssh2connect( connectionInfo );
                }
                await this.refreshPromise();
                this.execRefreshType(RefreshType.ALL);
            });
        };

        const jsonEditor = (file: File) => {
            process.nextTick( async () => {
                if ( file ) {
                    await this.editorPromise(file);
                    this.execRefreshType(RefreshType.ALL);
                }
            });
        };

        const connectionManager = new ConnectionManager( { parent: this.baseWidget } );
        connectionManager.on( "widget.connect", refreshNextTick);
        connectionManager.on( "widget.close", refreshNextTick);
        connectionManager.on( "widget.jsoneditor", jsonEditor);
        return RefreshType.OBJECT;
    }

    async ssh2connect( connectionInfo: IConnectionInfo ) {
        log.debug( "SSH Connection: %j", connectionInfo );

        const activePanel = this.activePanel();
        if ( activePanel instanceof BlessedPanel ) {
            const reader = activePanel.getReader();
            if ( reader instanceof FileReader ) {
                try {
                    const sftpReader = new SftpReader();
                    const result = await sftpReader.connect(connectionInfo, (err) => {
                        if ( err === "close" ) {
                            process.nextTick( async () => {
                                log.info( "SSH CLOSE EVENT !!!" );
                                await this.sshDisconnect();
                            });
                        }
                    });
                    if ( result === "SFTP" ) {
                        if ( activePanel.getReader() ) {
                            activePanel.getReader().destory();
                        }
                        activePanel.setReader( sftpReader );
                        const homeDir = await sftpReader.homeDir();
                        await activePanel.read( homeDir );
                        activePanel.setFocus();
                        activePanel.resetPosition();
                    } else if ( result === "SESSION_CLIENT" ) {
                        await this.terminalPromise(false, null, sftpReader);
                    }
                } catch( err ) {
                    log.error( err );
                    await messageBox({
                        parent: this.baseWidget,
                        title: T("Error"),
                        msg: err,
                        button: [ T("OK") ]
                    });
                    await this.sshDisconnect();
                }
            } else {
                await this.sshDisconnect();
            }
        }
    }

    async settingPromise() {
        const file = await FileReader.convertFile( "~/.m/configure.json" );
        return await this.editorPromise(file);
    }

    static instance() {
        if ( !(global as any).gMainFrame ) {
            log.debug( "MAINFRAME() START !!!");
            (global as any).gMainFrame = new MainFrame();
        }
        return (global as any).gMainFrame;
    }
}

