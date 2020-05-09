import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { Colorizer } from "logform";
import { BlessedPanel } from "./BlessedPanel";
import { FuncKeyBox } from './FuncKeyBox';
import BottomFilesBox from "./BottomFileBox";

const log = Logger("MainFrame");

let gMainFrame = null;

export class MainFrame {
    private screen = null;
    private blessedPanels = [];

    constructor() {
        this.screen = blessed.screen({
            smartCSR: true,
            fullUnicode: true,
            dockBorders: true,
            useBCE: true,
            ignoreDockContrast: true,
            debug: true,
            //dump: true,
            log: process.env.HOME + "/.m/m2.log"
        });
    }

    async start() {
        this.blessedPanels = [
            new BlessedPanel( { parent: this.screen, top: 1, left: 0, width: "50%", height: "100%-4", style: {bg: 'yellow'} } ),
            new BlessedPanel( { parent: this.screen, top: 1, left: "50%", width: "50%", height: "100%-4", style: {bg: 'yellow'} } )
        ];

        for ( var i = 0; i < this.blessedPanels.length; i++ ) {
            try {
                this.blessedPanels[i].initReader("file");
                await this.blessedPanels[i].read( "." );
            } catch ( e ) {
                log.error( e );
            }
        }

        new FuncKeyBox( this.screen );
        new BottomFilesBox( { parent: this.screen } );

        this.screen.key("q", () => {
            process.exit(0);
        });
    
        this.screen.key("tab", () => {
            this.changePanel();
        });

        this.blessedPanels[0].setFocus();
        this.screen.render();
    }

    changePanel() {
        const panel = this.blessedPanels.filter((item) => !item.hasFocus())[0];
        panel.setFocus();
        this.screen.render();
    }

    activePanel(): BlessedPanel {
        return this.blessedPanels.filter( i => i.hasFocus() )[0];
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
