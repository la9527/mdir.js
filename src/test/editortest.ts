import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors, ANSIImage } from "neo-blessed";
import { Logger, updateDebugFile } from "../common/Logger";
import { ImageWidget } from '../panel_blassed/widget/ImageBox';
import { draw } from "../panel_blassed/widget/BlessedDraw";
import { FileReader } from "../panel/FileReader";
import { BlessedEditor } from "../panel_blassed/BlessedEditor";
import { StringUtils } from "../common/StringUtils";

/*
console.log( StringUtils.scrSubstr("2", 0, 0) );
console.log( StringUtils.scrStrReplace("1", 0, 1) );
console.log( "1234567", 1, 5, StringUtils.scrSubstr("1234567", 1, 5) );
console.log( StringUtils.scrSubstr("1234567", 5, 3) );
console.log( StringUtils.scrSubstr("2", 0, 0) );
console.log( StringUtils.scrSubstr("21", 2, 0) );
console.log( "[" + StringUtils.scrSubstr("한글을 입력합니다.", 4, 1) + "]" );
*/

/*
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

    let fileReader = new FileReader();
    let file = fileReader.convertFile( "README.md" );

    const newView = new BlessedEditor( { parent: screen, top: 1, left: 0, width: "100%", height: "100%-2" }, 
                        fileReader );

    await newView.load( file );
    newView.setFocus();
    screen.render();
})();
*/
