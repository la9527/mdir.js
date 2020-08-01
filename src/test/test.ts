import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger, updateDebugFile } from "../common/Logger";
import { messageBox, MSG_BUTTON_TYPE } from '../panel_blassed/widget/MessageBox';
import mainFrame from "../panel_blassed/MainFrame";
import { ProgressBox } from "../panel_blassed/widget/ProgressBox";
import { StringUtils } from '../common/StringUtils';
import { Color } from "../common/Color";
import { inputBox } from "../panel_blassed/widget/InputBox";
import { Hint, KeyMappingInfo, menuKeyMapping, keyMappingExec, getHelpInfo } from '../config/KeyMapConfig';
import { BlessedXterm } from "../panel_blassed/BlessedXterm";
import { menuConfig } from "../config/MenuConfig";
import { BlessedMenu } from "../panel_blassed/BlessedMenu";
import { BlessedMcd } from "../panel_blassed/BlessedMcd";
import { readerControl } from "../panel/readerControl";
import { Mcd } from "../panel/Mcd";
import { FileReader } from "../panel/FileReader";
import { sprintf } from "sprintf-js";
import i18n from "i18next";
import I18nextCLILanguageDetector from 'i18next-cli-language-detector';
import en from "../translation/en.json";
import ko from "../translation/ko.json";
import { button } from '../../@types/blessed';
import { BlessedEditor } from "../panel_blassed/BlessedEditor";

/*
const T = ( ...a ) => {
    return i18n.t.apply( i18n, a );
};

(async () => {
    const T = await i18n.use(I18nextCLILanguageDetector).init({
        debug: true,
        resources: { 
            en: { translation: en }, 
            ko: { translation: ko }
        },
        // lng: "ko",
    });
    
    console.log( T("Hint.Paste") );
})();
*/

// console.log( StringUtils.ellipsis("ABCDEFGHJKLMNOPRSTUVWXYZ1234567890", 20) );


// menuKeyMapping( KeyMappingInfo, menuConfig );

// console.log( JSON.stringify( menuConfig, null, 4) );

const screen = blessed.screen({
    smartCSR: true,
    fullUnicode: true,
    dockBorders: true,
    useBCE: true,
    ignoreDockContrast: true,
    // debug: true,
    //dump: true,
    //log: process.env.HOME + "/.m/m2.log"
});

screen.key("q", () => {
    process.exit(0);
});
    
screen.key("t", async () => {
    const result = await messageBox({
        parent: screen,
        title: "TEST",
        msg: "TEST 합니다.",
        textAlign: "left",
        buttonType: MSG_BUTTON_TYPE.AUTO,
        scroll: false,
        button: [ "OK", "Cancel", "ITEM1", "ITEM2" ]
    }, { parent: screen });
});

screen.render();

/*
(async () => {
    const helpInfo = getHelpInfo();
        let viewText = [];
        for ( const frame of [ "Common", "Panel", "Mcd" ] ) {
            viewText.push(`${frame})` );

            let subText = [];
            for ( const item in helpInfo[frame] ) {
                if ( helpInfo[frame][item].humanKeyName ) {
                    subText.push( sprintf("{yellow-fg}%14s{/yellow-fg} : %s", helpInfo[frame][item].humanKeyName, helpInfo[frame][item].text ) );
                }
            }
            subText.sort();
            
            viewText = viewText.concat( subText );
            viewText.push( "" );
        }

        log.debug( "viewText: %s", viewText );

    await messageBox({
        parent: screen,
        title: "Help",
        msg: viewText.join("\n"),
        textAlign: "left",
        scroll: false,
        button: [ "OK" ]
    }, { parent: screen });
})();

screen.render();
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
    
    const mcd = new Mcd(readerControl("file"));
    await mcd.scanCurrentDir();

    
    onst fileReader = new FileReader();
    await fileReader.readdir( fileReader.currentDir() );
    
    console.log( "END !!! ");
})();
*/
/*
(async () => {
    screen.key("q", () => {
        process.exit(0);
    });

    screen.key("r", () => {
        screen.render();
    });

    screen.render();

    let blessedProgram = null;
    try {
        screen.key("c", async () => {
            blessedProgram = new BlessedXterm( { 
                parent: screen,
                cursorBlink: true,
                label: ' multiplex.js ',
                left: "center",
                top: "center",
                width: '50%',
                height: '50%',
                border: 'line',
                style: {
                    fg: 'default',
                    bg: 'default',
                    focus: {
                        border: {
                            fg: 'green'
                        }
                    }
                }
            }, null, null);
            blessedProgram.setFocus();
        });

        screen.key("k", async () => {
            blessedProgram && blessedProgram.destroy();

            let msg = `FAIL : Common.mountListPromise()\n` +
                `Error: Command failed: lsblk --bytes --all --pairs\n` +
                `\n` +
                `lsblk: failed to access sysfs directory: /sys/dev/block: No such file or directory\n` +
                `    at ChildProcess.exithandler (child_process.js:303:12)\n` +
                `    at ChildProcess.emit (events.js:315:20)\n` +
                `    at maybeClose (internal/child_process.js:1051:16)\n` +
                `    at Process.ChildProcess._handle.onexit (internal/child_process.js:287:5)]\n`;

            await messageBox( { parent: screen, title: "TEST", msg, button: ["OK"], textAlign: "left" });

            blessedProgram = null;
            screen.render();
        });
        
    } catch( e ) {
        log.error( e.stack );
    }
})();
*/
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
    screen.render();
})();

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
