import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "./common/Logger";
import { Colorizer } from "logform";
import { BlessedPanel } from "./panel_blassed/BlessedPanel";
import { FuncKeyBox } from './panel_blassed/FuncKeyBox';
import { Widget } from "./panel_blassed/Widget";
import mainFrame, { MainFrame } from "./panel_blassed/MainFrame";

const log = Logger("main");

/*
const program: BlessedProgram = blessed.program();

program.alternateBuffer();
program.enableMouse();
program.hideCursor();
program.clear();

program.on("keypress", (ch, key) => {
    if (key.name === "q") {
        program.clear();
        program.disableMouse();
        program.showCursor();
        program.normalBuffer();
        process.exit(0);
    }
});

program.move(5, 5);
program.write("Hello world");
program.move(10, 10);
*/

/*
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
    let blessedPanels = [
        new BlessedPanel( { parent: screen, top: 1, left: 0, width: "50%", height: "100%-4", style: {bg: 'yellow'} } ),
        new BlessedPanel( { parent: screen, top: 1, left: "50%", width: "50%", height: "100%-4", style: {bg: 'yellow'} } )
    ];

    for ( var i = 0; i < blessedPanels.length; i++ ) {
        try {
            blessedPanels[i].initReader("file");
            await blessedPanels[i].read( "." );
        } catch ( e ) {
            log.error( e );
        }
    }

    new FuncKeyBox( screen );

    blessedPanels[0].setFocus();

    screen.key("q", () => {
        process.exit(0);
    });

    screen.key("tab", () => {
        const panel = blessedPanels.filter((item) => !item.hasFocus())[0];
        panel.setFocus();
        screen.render();
    });
    screen.render();
})();
*/

(async () => {
    const frame = mainFrame();
    await frame.start();
})();
