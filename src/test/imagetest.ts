import * as blessed from "neo-blessed";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { Logger, updateDebugFile } from "../common/Logger";
import { ImageBox } from '../panel_blassed/widget/ImageBox';

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
    const image = new ImageBox({ parent: screen, top: 0, left: 0, width: "100%", height: "100%", style: { bg: "blue" } });
    image.setImage( "./fixture.jpg" );
    screen.render();
});

screen.render();

