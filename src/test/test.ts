import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger } from "../common/Logger";
import { messageBox } from "../panel_blassed/widget/MessageBox";
import mainFrame from "../panel_blassed/MainFrame";
import { ProgressBox } from "../panel_blassed/widget/ProgressBox";
import { StringUtils } from '../common/StringUtils';
import { Color } from "../common/Color";
import { inputBox } from "../panel_blassed/widget/InputBox";

const log = Logger( "TEST" );

// console.log( StringUtils.ellipsis("ABCDEFGHJKLMNOPRSTUVWXYZ1234567890", 20) );

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
        const result = await inputBox( {
            parent: screen,
            title: "INPUT BOX TEST",
            defaultText: "defaultText",
            button: [ "OK", "Cancel" ]
        });

        log.debug( "INPUTBOX RESULT : %s", result );
    } catch( e ) {
        log.error( e.stack );
    }

    /*
    try {
        let result = await messageBox( {
            title: "Copy",
            msg: `'TEST' file exists. What would you do want?`,
            button: [ "Overwrite", "Skip", "Rename", "Overwrite All", "Skip All" ]
        }, { parent: screen });
    } catch( e ) {
        log.error( e );
    }
    
    const progressBox = new ProgressBox( { title: "Copy", msg: "Calculating...", cancel: () => {
        log.debug( "Cancel Button !!!");
        screen.render();
    }}, { parent: screen });
    progressBox.init();

    let i = 0;
    let interval = setInterval( () => {
        let lastText = (new Color(3, 0)).fontHexBlessFormat(StringUtils.sizeConvert(i*1000).trim()) + "/" + 
                        (new Color(3, 0)).fontHexBlessFormat(StringUtils.sizeConvert(i*1000).trim()) +
                        `(${StringUtils.sizeConvert(121242,false).trim()}/s)`;
        // progressBox.updateProgress( source.fullname, lastText, copyBytes, fullFileSize );
        progressBox.updateProgress("ABCDEFGHJKLMNOPRSTUVWXYZ1234567890ABCDEFGHJKLMNOPRSTUVWXYZ1234567890ABCDEFGHJKLMNOPRSTUVWXYZ1234567890ABCDEFGHJKLMNOPRSTUVWXYZ1234567890", lastText, ++i, 100);
        if ( i === 100 ) {
            clearInterval( interval );
        }
    }, 50);
    */

    screen.render();
})();


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
    let result = new MessageBox({
        title: "테스트 타이틀",
        msg: "테스트 합니다. 확인 바랍니다.",
        button: [ "OK", "Cancel"],
        result: ( result ) => {
            log.debug( result );
            screen.render();
        }
    }, { parent: screen });

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
