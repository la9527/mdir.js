import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "./common/Logger";
import { BlessedMenu } from "./panel_blassed/BlessedMenu";
import { BlessedPanel } from './panel_blassed/BlessedPanel';
import { FuncKeyBox } from './panel_blassed/FuncKeyBox';
import { Widget } from "./panel_blassed/Widget";
import mainFrame, { MainFrame } from "./panel_blassed/MainFrame";
import { BlessedMcd } from "./panel_blassed/BlessedMcd";
import { readerControl } from './panel/readerControl';
import { keyMappingExec, menuKeyMapping, KeyMappingInfo, keyHumanReadable } from "./config/KeyMapConfig";
import { menuConfig } from "./config/MenuConfig";
import { Mcd } from "./panel/Mcd";

const log = Logger("main");

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
    menuKeyMapping( KeyMappingInfo, menuConfig );
    
    let blessedMenu = new BlessedMenu({ parent: screen });
    blessedMenu.setMainMenuConfig( menuConfig.Panel );

    screen.on('keypress', async (ch, keyInfo) => {
        if ( await keyMappingExec( blessedMenu, keyInfo ) ) {
            screen.render();
        }
    });

    screen.key("q", () => {
        process.exit(0);
    });

    screen.key("r", () => {
        screen.render();
    });

    screen.render();
})();
*/

/*
(async () => {

    const mcd = new BlessedMcd({ parent: screen, top: 1, left: 0, width: "100%", height: "100%-2" });
    mcd.setReader(readerControl("file"));
    await mcd.scanCurrentDir();
    mcd.setFocus();
    
    screen.key("q", () => {
        process.exit(0);
    });

    screen.key("r", () => {
        screen.render();
    });

    screen.render();
})();
*/

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

(async () => {
    await mainFrame().start();
})();

