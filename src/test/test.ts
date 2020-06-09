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
            title: "INPUT BOX TEST",
            defaultText: "defaultText",
            button: [ "OK", "Cancel" ]
        }, { parent: screen });

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
