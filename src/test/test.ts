process.env.NODE_ENV = "test";

/* eslint-disable @typescript-eslint/no-unused-vars */
import blessed from "neo-blessed";
const { BlessedProgram, box, text, colors, program } = blessed;
import { Widgets } from "../../@types/blessed";
import { Logger } from "../common/Logger.mjs";
import { messageBox, MSG_BUTTON_TYPE } from "../panel_blassed/widget/MessageBox.mjs";
import mainFrame from "../panel_blassed/MainFrame.mjs";
import { ProgressBox } from "../panel_blassed/widget/ProgressBox.mjs";
import { StringUtils } from "../common/StringUtils.mjs";
import { Color } from "../common/Color.mjs";
import { inputBox } from "../panel_blassed/widget/InputBox.mjs";
import { Hint, KeyMappingInfo, menuKeyMapping, keyMappingExec, getHelpInfo } from "../config/KeyMapConfig.mjs";
import { BlessedXterm } from "../panel_blassed/BlessedXterm.mjs";
import { menuConfig } from "../config/MenuConfig.mjs";
import { BlessedMenu } from "../panel_blassed/BlessedMenu.mjs";
import { BlessedMcd } from "../panel_blassed/BlessedMcd.mjs";
import { readerControl } from "../panel/readerControl.mjs";
import { Mcd } from "../panel/Mcd.mjs";
import { FileReader } from "../panel/FileReader.mjs";
import { sprintf } from "sprintf-js";
import i18n from "i18next";
import I18nextCLILanguageDetector from "i18next-cli-language-detector";
import en from "../translation/en.json";
import ko from "../translation/ko.json";
import { button } from "../../@types/blessed";
import { BlessedEditor } from "../panel_blassed/BlessedEditor.mjs";
import { i18nInit, T, changeLanguage } from "../common/Translation.mjs";
import { osLocale } from "os-locale";
import { ConnectionEditor, IConnectionEditorOption } from "../panel_blassed/widget/ConnectionEditor.mjs";
import { ConnectionManager } from "../panel_blassed/widget/ConnectionManager.mjs";

const log = Logger("TEST_MAIN");

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

const testTextColor = (text, fg, bg) => {
    const fgF = (screen.program as any)._attr(fg + " fg", true);
    const fgE = (screen.program as any)._attr(fg + " fg", false);
    const bgF = (screen.program as any)._attr(bg + " bg", true);
    const bgE = (screen.program as any)._attr(bg + " bg", false);
    return fgF + bgF + text + bgE + bgE;
};

screen.key("e", () => {
    const test = "TEST";
    const fg = 3;
    const bg = 8;
    log.debug( "[%s] [%s]", test, testTextColor(test, fg, bg) );
});

screen.key("m", async () => {
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

screen.key("i", async () => {
    const result = await inputBox( {
        parent: screen,
        title: "InputBox TITLE",
        defaultText: "DEFAULT TEST !!!",
        button: [ "OK", "Cancel" ]
    });
    log.info( "RESULT : %j", result );
});

screen.key("t", async () => {
    (global as any).LOCALE = await osLocale();
    await i18nInit( (global as any).LOCALE.match( /^ko/ ) ? "ko" : undefined );

    const connectionInfo: IConnectionEditorOption = {
        name: "테스트",
        info: [
            {
                protocol: "SFTP",
                host: "127.0.0.1",
                port: 22, // default 22
                username: "la9527_sftp",
                password: "test",
                privateKey: "~/.ssh/id_rsa",
                proxyInfo: {
                    host: "127.0.0.1",
                    port: 4016,
                    type: 5,
                    username: "la9527",
                    password: "test"
                },
            },
            {
                protocol: "SSH",
                host: "127.0.0.1",
                port: 22, // default 22
                username: "la9527_ssh",
                password: "test",
                privateKey: "~/.ssh/id_rsa",
                proxyInfo: {
                    host: "127.0.0.1",
                    port: 4016,
                    type: 5,
                    username: "la9527",
                    password: "test"
                },
            }
        ],
        resultFunc: (result, message) => {
            screen.destroy();
            console.log( result, JSON.stringify(message, null, 2) );
        }
    };
    new ConnectionEditor(connectionInfo, { parent: screen });
    screen.render();
    // new ConnectionManager({ parent: screen });
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
