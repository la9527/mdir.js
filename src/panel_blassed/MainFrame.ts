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
import { IMountList, } from "../common/Reader";
import { messageBox, MSG_BUTTON_TYPE } from "./widget/MessageBox";
import { StringUtils } from "../common/StringUtils";
import { BlessedXterm } from "./BlessedXterm";
import { sprintf } from "sprintf-js";
import { T } from "../common/Translation";
import { ImageViewBox } from "./widget/ImageBox";
import { File } from "../common/File";
import { BaseMainFrame } from "./BaseMainFrame";
import { ConnectionManager } from "./widget/ConnectionManager";
import { IConnectionInfo } from "./widget/ConnectionEditor";

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

    @Help(T("Help.Editor"))
    async editorPromise(file: File = null) {
        const view = this.blessedFrames[this.activeFrameNum];
        if ( view instanceof BlessedPanel ) {
            view.destroy();

            const newView = new BlessedEditor( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;

            try {
                await newView.load( file || view.currentFile() );
            } catch ( e ) {
                await messageBox({
                    parent: this.baseWidget,
                    title: T("Error"),
                    msg: T("Message.FILE_OPEN_FAILURE") + "\n" + e.message,
                    button: [ T("OK") ]
                });
                return await this.editorPromise(file);
            }
        } else if ( view instanceof BlessedEditor ) {
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
                const maxLength = [ 0, 0 ];
                mountList.sort( (a, b) => {
                    maxLength[0] = Math.max( maxLength[0], a.mountPath.fullname.length );
                    maxLength[1] = Math.max( maxLength[1], a.description.length );

                    if ( a.mountPath.fullname > b.mountPath.fullname ) return 1;
                    if ( b.mountPath.fullname > a.mountPath.fullname ) return -1;
                    return 0;
                });

                const viewMountInfo = mountList.map( (item) => {
                    return sprintf(`%-${maxLength[0] + 2}s | %-${maxLength[1] + 2}s | %s`, item.mountPath.fullname, item.description, StringUtils.sizeConvert(item.size, true));
                });

                log.debug( viewMountInfo );

                try {
                    const result = await messageBox( { parent: this.baseWidget, title: T("Message.MountList"), msg: "", button: viewMountInfo, buttonType: MSG_BUTTON_TYPE.VERTICAL } );
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
        const panel = this.activePanel();
        if ( panel instanceof BlessedPanel ) {
            file = panel.currentFile();
        }
        if ( !file ) {
            return;
        }
        if (process.env.TERM_PROGRAM === "iTerm.app") {
            const buffer = await fs.promises.readFile(file.fullname);

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

            await new Promise( (resolve) => {
                const program = this.screen.program;
                this.screen.leave();
                process.stdout.write( iTermImage(buffer, { height: "95%" }) );
                process.stdout.write( "\n" + colors.white(T("Message.ANY_KEY_RETURN_M_JS")) + "\n" );
                program.once( "keypress", () => {
                    resolve();
                });
            });
            this.screen.enter();
            await this.refreshPromise();
            this.execRefreshType( RefreshType.ALL );
        } else {
            setTimeout( async () => {
                const imageViewBox = new ImageViewBox( { parent: this.baseWidget } );
                this.screen.render();
                await imageViewBox.setImageOption({
                    file: file,
                    closeFunc: async () => {
                        log.debug( "CLOSE !!!");
                        this.execRefreshType( RefreshType.ALL );
                    }
                });
                this.screen.render();
            }, 100);
        }
    }

    connectionManager() {
        const refreshNextTick = (connectionInfo: IConnectionInfo = null) => {
            process.nextTick( async () => {
                this.activePanel().setFocus();
                await this.refreshPromise();
                this.execRefreshType(RefreshType.ALL);
                if ( connectionInfo ) {
                    this.sshConnect( connectionInfo );
                }
            });
        };

        const connectionManager = new ConnectionManager( { parent: this.baseWidget } );
        connectionManager.on( "widget.connect", refreshNextTick);
        connectionManager.on( "widget.close", refreshNextTick);
    }

    sshConnect( connectionInfo: IConnectionInfo ) {
        log.debug( "SSH Connection: %j", connectionInfo );
    }

    static instance() {
        if ( !(global as any).gMainFrame ) {
            log.debug( "MAINFRAME() START !!!");
            (global as any).gMainFrame = new MainFrame();
        }
        return (global as any).gMainFrame;
    }
}

