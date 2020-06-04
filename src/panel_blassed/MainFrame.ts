import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, screen } from "neo-blessed";
import { Logger } from "../common/Logger";
import { BlessedPanel } from './BlessedPanel';
import { FuncKeyBox } from './FuncKeyBox';
import BottomFilesBox from "./BottomFileBox";
import { readerControl } from '../panel/readerControl';
import { Widget } from "./Widget";
import { keyMappingExec, menuKeyMapping, KeyMappingInfo, KeyMapping, RefreshType } from "../config/KeyMapConfig";
import { menuConfig } from "../config/MenuConfig";
import { BlessedMenu } from "./BlessedMenu";
import { BlessedMcd } from './BlessedMcd';
import { CommandBox } from './CommandBox';
import { exec } from "child_process";
import * as colors from "colors";

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

    constructor() {
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
            if ( this.commandBox ) {
                log.debug( "CommandBox running !!!" );
                return;
            }

            log.info( "KEYPRESS [%s] - START", keyInfo.name );

            let starTime = Date.now();

            const execRefresh = ( type: RefreshType ) => {
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
            
            let type: RefreshType = await keyMappingExec( this.activeFocusObj(), keyInfo );
            if ( type === RefreshType.NONE ) {
                type = await keyMappingExec( this, keyInfo );
            }
            execRefresh( type );
            log.info( "KEYPRESS [%s] - (%dms)", keyInfo.name, Date.now() - starTime );
        });
    }

    refresh() {
        this.screen.realloc();
        // this.baseWidget.render();
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
            program.once( 'keypress', () => {
                this.screen.enter();
                this.refresh();
                resolve();
            });
        });
    }

    commandRun(cmd): Promise<void> {
        let cmds = cmd.split(" ");
        if ( cmds[0] === "cd" && cmds[1] ) {
            return new Promise( (resolve) => {
                let chdirPath = cmds[1] === "-" ? this.activePanel().previousDir : cmds[1];
                this.activePanel().read(chdirPath).then( () => {
                    resolve();
                }).catch( () => {
                    resolve();
                });
            });
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
            
            console.log( colors.white("m.js $ ") + cmd );

            exec(cmd, (error, stdout, stderr) => {
                if (error) {
                    console.error(error.message);
                } else {
                    stderr && console.error(stderr.normalize());
                    stdout && console.log(stdout.normalize());
                }
                console.log( colors.white("Press any key to return m.js") );
                program.once( 'keypress', () => {
                    this.screen.enter();
                    this.refresh();
                    resolve();
                });
            });
        });
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
