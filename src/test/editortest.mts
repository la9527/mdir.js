/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import blessed from "neo-blessed";
const { box, colors } = blessed;
import { Widgets, BlessedProgram } from "neo-blessed";
import { Logger, updateDebugFile } from "../common/Logger.mjs";
import { ImageWidget } from "../panel_blassed/widget/ImageBox.mjs";
import { draw } from "../panel_blassed/widget/BlessedDraw.mjs";
import { FileReader } from "../panel/FileReader.mjs";
import { BlessedEditor } from "../panel_blassed/BlessedEditor.mjs";
import { StringUtils, StringLineToken } from "../common/StringUtils.mjs";

/*
let text = "";
for ( let i = 0; i < 50000; i++ ) {
    text += String.fromCharCode(65 + Math.floor(Math.random() * 1020));
}

let tokenCheck = (token: StringLineToken) => {
    // token.setString( "한글을 입력합니다.", 4 );
    //token.setString( "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 10 );
    token.setString( text, 10 );
    //token.setString( "", 10 );
    do {
        if ( !token.next(true) ) break;
        console.log( token.next(true), token.getToken(), token.curLine );
    } while( token.next() );
};

console.log( "StringLineToken1");
tokenCheck( new StringLineToken() );
console.log( "StringLineToken2");
//tokenCheck( new StringLineToken2() );
*/
/*
console.log( StringUtils.scrSubstr("2", 0, 0) );
console.log( StringUtils.scrStrReplace("1", 0, 1) );
console.log( "1234567", 1, 5, StringUtils.scrSubstr("1234567", 1, 5) );
console.log( StringUtils.scrSubstr("1234567", 5, 3) );
console.log( StringUtils.scrSubstr("2", 0, 0) );
console.log( StringUtils.scrSubstr("21", 2, 0) );
console.log( "[" + StringUtils.scrSubstr("한글을 입력합니다.", 4, 1) + "]" );
*/

(async () => {
    const screen = blessed.screen({
        smartCSR: true,
        fullUnicode: true,
        dockBorders: true,
        useBCE: true,
        ignoreDockContrast: true,
        debug: true,
        //dump: true,
        //log: process.env.HOME + "/.m/m2.log"
    });

    screen.key("q", () => {
        process.exit(0);
    });

    screen.key("d", () => {
        screen.program.disableMouse();
    });

    screen.key("e", () => {
        screen.program.enableMouse();
    });

    let fileReader = new FileReader();
    let file = await fileReader.convertFile( "README.md" );

    const newView = new BlessedEditor( { parent: screen, top: 1, left: 0, width: "100%", height: "100%-2" }, 
                        fileReader );

    await newView.load( file );
    newView.setFocus();
    screen.render();
})();
