import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors, ANSIImage } from "neo-blessed";
import { Logger, updateDebugFile } from "../common/Logger";
import { ImageWidget } from '../panel_blassed/widget/ImageBox';
import { draw } from "../panel_blassed/widget/BlessedDraw";
import { FileReader } from "../panel/FileReader";
import { BlessedEditor } from "../panel_blassed/BlessedEditor";
import { StringUtils } from "../common/StringUtils";

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

/*
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

screen.draw = (start, end) => {
    draw.call(screen, start, end);
};

screen.key("q", () => {
    process.exit(0);
});
    
screen.key("t", async () => {
    let fileReader = new FileReader();
    let file = fileReader.convertFile( "README.md" );

    const newView = new BlessedEditor( { parent: screen, top: 1, left: 0, width: "100%", height: "100%-2" }, 
                        fileReader );

    await newView.load( file );
    newView.setFocus();
    screen.render();
});

screen.render();
*/
