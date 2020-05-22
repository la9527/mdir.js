import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { BlessedPanel } from "./BlessedPanel";
import { FuncKeyBox } from './FuncKeyBox';
import BottomFilesBox from "./BottomFileBox";
import { readerControl } from '../panel/readerControl';
import { Widget } from "./Widget";
import { keyMappingExec } from "../config/KeyMapConfig";

const log = Logger("MainFrame");

let gMainFrame = null;

enum VIEW_TYPE {
    NORMAL = 0,
    VERTICAL_SPLIT = 1,
    HORIZONTAL_SPLIT = 2
}

export class MainFrame {
    private screen = null;
    private viewType: VIEW_TYPE = VIEW_TYPE.NORMAL;
    private blessedFrames = [];

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
        this.blessedFrames = [
            new BlessedPanel( { parent: this.screen } ),
            new BlessedPanel( { parent: this.screen } )
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

        new FuncKeyBox( this.screen );
        new BottomFilesBox( { parent: this.screen } );

        this.screen.on('keypress', async (ch, keyInfo) => {
            if ( await keyMappingExec( this.activePanel(), keyInfo ) ) {
                this.screen.render();
            }
        });

        this.screen.key(['C-w'], () => {
            log.debug( "split !!!" );
            this.viewType++;
            if ( this.viewType > 2 ) {
                this.viewType = 0;
            }
            this.viewRender();
            this.screen.render();
        });

        this.screen.key("q", () => {
            process.exit(0);
        });
    
        this.screen.key("tab", () => {
            this.changePanel();
        });

        this.screen.key("f5", () => {
            log.debug( "F5 !!!" );
            this.screen.realloc();
            this.screen.render();
        });

        this.blessedFrames[0].setFocus();
        this.screen.render();
    }

    changePanel() {
        const panel = this.blessedFrames.filter((item) => !item.hasFocus());
        if ( panel && panel.length > 0 ) {
            panel[0].setFocus();
        }
        this.screen.render();
    }

    activePanel(): BlessedPanel {
        return this.blessedFrames.filter( i => i.hasFocus() )[0];
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
