import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors, ANSIImage } from "neo-blessed";
import { Logger, updateDebugFile } from "../common/Logger";
import { ImageWidget } from '../panel_blassed/widget/ImageBox';
import { draw } from "../panel_blassed/widget/BlessedDraw";

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
    const image = new ImageWidget({ parent: screen, top: 0, left: 0, width: "100%", height: "100%", style: { bg: "blue" } });
    // await image.setImage( "/Users/la9527/MyProject/m.js/images/mdir_v0.1_windows10_cmd.png" ); // ./fixture.jpg
    await image.setImage( "./fixture.jpg" ); // ./fixture.jpg
    screen.render();
});

screen.render();

