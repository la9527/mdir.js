import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { messageBox } from "../panel_blassed/widget/MessageBox";
import mainFrame from "../panel_blassed/MainFrame";

const log = Logger( "TEST" );

const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    useBCE: true,
    ignoreDockContrast: true,
    debug: true,
    //dump: true,
    log: process.env.HOME + "/.m/m2.log"
});

(async () => {
    screen.key("q", () => {
        process.exit(0);
    });

    screen.key("r", () => {
        screen.render();
    });

    try {
        let result = await messageBox( {
            title: "Copy",
            msg: `'TEST' file exists. What would you do want?`,
            button: [ "Overwrite", "Skip", "Rename", "Overwrite All", "Skip All" ]
        }, { parent: screen });
    } catch( e ) {
        log.error( e );
    }
})();
