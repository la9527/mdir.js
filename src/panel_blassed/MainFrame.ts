import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { BlessedPanel } from "./BlessedPanel";
import { FuncKeyBox } from './FuncKeyBox';
import BottomFilesBox from "./BottomFileBox";
import { readerControl } from '../panel/readerControl';
import { Widget } from "./Widget";
import { keyMappingExec, menuKeyMapping, KeyMappingInfo, KeyMapping } from "../config/KeyMapConfig";
import { menuConfig } from "../config/MenuConfig";
import { BlessedMenu } from "./BlessedMenu";

const log = Logger("MainFrame");

let gMainFrame = null;

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

    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            fullUnicode: true,
            dockBorders: true,
            useBCE: true,
            ignoreDockContrast: true,
            debug: false,
            //dump: true,
            log: process.env.HOME + "/.m/m2.log"
        });

        this.baseWidget = new Widget( { parent: this.screen, left: 0, top: 0, width: "100%", height: "100%" } );
    }

    async viewRender() {
        const updateWidget = ( widget: Widget, opt ) => {
            widget.top = opt.top;
            widget.left = opt.left;
            widget.height = opt.height;
            widget.width = opt.width;
            widget.box.show();
        };

        if ( this.viewType === VIEW_TYPE.NORMAL ) {
            updateWidget( this.blessedFrames[0].getWidget(), { top: 1, left: 0, width: "100%", height: "100%-4" } );
            this.blessedFrames[1].getWidget().box.hide();
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

        this.blessedFrames = [
            new BlessedPanel( { parent: this.baseWidget } ),
            new BlessedPanel( { parent: this.baseWidget } )
        ];

        for ( var i = 0; i < this.blessedFrames.length; i++ ) {
            try {
                this.blessedFrames[i].initReader(readerControl("file"));
                await this.blessedFrames[i].read( "." );
            } catch ( e ) {
                log.error( e );
            }
        }

        this.viewRender();

        new FuncKeyBox( this.baseWidget.box );
        new BottomFilesBox( { parent: this.baseWidget } );

        this.screen.on('keypress', async (ch, keyInfo) => {
            if ( await keyMappingExec( this.activeFocusObj(), keyInfo ) ) {
                this.baseWidget.render();
                this.screen.render();
            } else {
                if ( await keyMappingExec( this, keyInfo ) ) {
                    this.baseWidget.render();
                    this.screen.render();
                }
            }
        });

        this.screen.key("q", () => {
            process.exit(0);
        });
    
        this.blessedFrames[0].setFocus();
        this.screen.render();
    }

    refresh() {
        this.screen.realloc();
        this.screen.render();
    }

    split() {
        this.viewType++;
        if ( this.viewType > 2 ) {
            this.viewType = 0;
        }
        this.viewRender();
        this.screen.render();
    }

    quit() {
        process.exit(0);
    }

    nextWindow() {
        const panel = this.blessedFrames.filter((item) => !item.hasFocus());
        if ( panel && panel.length > 0 ) {
            panel[0].setFocus();
        }
        this.screen.render();
    }

    activePanel(): BlessedPanel {
        let activePanel = this.blessedFrames.filter( i => i.hasFocus() );
        return activePanel.length === 0 ? this.blessedFrames[0] : activePanel[0];
    }

    activeFocusObj(): any {
        if ( this.blessedMenu && this.blessedMenu.hasFocus() ) {
            return this.blessedMenu;
        }
        return this.activePanel();
    }

    menu() {
        let viewName = this.activeFocusObj().viewName || "Common";
        log.debug( "menuConfig[ viewName ] !!!", viewName, menuConfig[ viewName ] );

        this.blessedMenu = new BlessedMenu({ parent: this.baseWidget });
        this.blessedMenu.setMainMenuConfig( menuConfig[ viewName ] );
        this.blessedMenu.setFocus();
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
