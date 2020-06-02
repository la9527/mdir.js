import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { BlessedPanel } from './BlessedPanel';
import { FuncKeyBox } from './FuncKeyBox';
import BottomFilesBox from "./BottomFileBox";
import { readerControl } from '../panel/readerControl';
import { Widget } from "./Widget";
import { keyMappingExec, menuKeyMapping, KeyMappingInfo, KeyMapping } from "../config/KeyMapConfig";
import { menuConfig } from "../config/MenuConfig";
import { BlessedMenu } from "./BlessedMenu";
import { BlessedMcd } from './BlessedMcd';
import { CommandBox } from './CommandBox';

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
    private screen = null;
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

        this.baseWidget = new Widget( { parent: this.screen, left: 0, top: 0, width: "100%", height: "100%" } );
        this.blessedMenu = new BlessedMenu({ parent: this.baseWidget });

        this.baseWidget.on("remove", (element) => {
            log.debug( "remove element: %s - %d", element.options.name, element.options.viewCount );
        });
    }

    async mcdPromise() {
        log.debug( "mcdPromise !!!!");
        let view: BlessedPanel | BlessedMcd = this.blessedFrames[this.activeFrameNum];
        if ( view instanceof BlessedPanel ) {
            view.destroy();

            const newView = new BlessedMcd( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
            await newView.scanDir( view.currentPath() );
            newView.setFocus();
            this.blessedFrames[this.activeFrameNum] = newView;
        } else if ( view instanceof BlessedMcd ) {
            view.destroy();

            const newView = new BlessedPanel( { parent: this.baseWidget, viewCount: viewCount++ }, view.getReader() );
            await newView.read( view.currentPathFile() );
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
        menuKeyMapping( KeyMappingInfo, menuConfig );

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

        this.screen.on('keypress', async (ch, keyInfo) => {
            if ( this.commandBox ) {
                log.debug( "CommandBox running !!!" );
                return;
            }
            if ( await keyMappingExec( this.activeFocusObj(), keyInfo ) ) {
                this.screen.render();
            } else {
                if ( await keyMappingExec( this, keyInfo ) ) {
                    this.screen.render();
                }
            }
        });

        this.screen.key("q", () => {
            process.exit(0);
        });
    
        this.blessedFrames[0].setFocus();
        // this.baseWidget.render();
        this.screen.render();
    }

    refresh() {
        this.screen.realloc();
        this.baseWidget.render();
        this.screen.render();
    }

    split() {
        this.viewType++;
        if ( this.viewType > 2 ) {
            this.viewType = 0;
        }
        log.debug( "split: viewNumber [%d]", (this.viewType as number) );
        this.viewRender();
        this.baseWidget.render();
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
    }

    activePanel(): BlessedPanel {
        log.debug( "activePanel %d", this.activeFrameNum );
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
    }

    menuClose() {
        this.blessedMenu.close();
    }

    commandBoxShow() {
        if ( this.bottomFilesBox ) {
            this.bottomFilesBox.destroy();
            this.bottomFilesBox = null;
        }

        this.commandBox = new CommandBox( { parent: this.baseWidget } );
        this.commandBox.setPanelView( this.activePanel() );
        this.commandBox.setFocus();
    }

    commandBoxClose() {
        if ( this.commandBox ) {
            this.commandBox.destroy();
            this.commandBox = null;
        }
        this.bottomFilesBox = new BottomFilesBox( { parent: this.baseWidget } );
        this.baseWidget.render();
    }

    commandRun(cmd) {
        log.debug( "commandRun : %s", cmd );
        // this.screen.exec( cmd );
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
