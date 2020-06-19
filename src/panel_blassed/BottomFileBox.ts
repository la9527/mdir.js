import { sprintf } from "sprintf-js";
import { BlessedProgram, Widgets, box, text, colors } from "neo-blessed";
import { strWidth } from "neo-blessed/lib/unicode";
import { Widget } from "./widget/Widget";
import mainFrame from "./MainFrame";
import { Logger } from "../common/Logger";
import { File } from "../common/File";
import { StringUtils } from "../common/StringUtils";
import { scrstrncpy } from "./ScreenUtils";
import { ColorConfig } from "../config/ColorConfig";
import { Color } from "../common/Color";
import { BlessedPanel } from './BlessedPanel';
import * as FileType from "file-type";

const log = Logger("BottomFilesBox");

export default class BottomFilesBox extends Widget {
    colorFunc: Color = null;

    constructor( opt: Widgets.BoxOptions ) {
        super( { left: 0, bottom: 0, width: "100%", height: 1, ...opt } );
        this.colorFunc = ColorConfig.instance().getBaseColor("func");
    }

    convertFilename(file: File, filenameMaxSize: number) {
        let fileName = file.name;
        if ( file.link ) {
            fileName = file.name + " -> " + (file.link.file ? file.link.file.fullname : file.link.name);
        }
        const repeatSize = filenameMaxSize - strWidth(fileName);
        let textFileName = fileName;
        if ( repeatSize > 0 ) {
            textFileName = fileName; // + " ".repeat(repeatSize);
        } else if ( repeatSize < 0 ) {
            textFileName = scrstrncpy( fileName, 0, filenameMaxSize - 1) + "~";
        }
        return textFileName;
    }

    draw() {
        let panel = mainFrame().activePanel();
        if ( !(panel instanceof BlessedPanel) ) {
            return;
        }
        
        const file = panel.currentFile();
        if ( !file ) {
            return;
        }

        log.debug("BottomFilesBox draw !!!");
        const d = file.mtime;
        const date = [d.getFullYear(), ("0" + (d.getMonth() + 1)).slice(-2), ("0" + d.getDate()).slice(-2)].join("-");
        const time = [("0" + (d.getHours() + 1)).slice(-2), ("0" + (d.getMinutes() + 1)).slice(-2)].join(":");

        this.setColor( this.colorFunc );

        const textFileName = this.convertFilename(file, this.width as number - 50);
        let viewText = null;
        if ( process.platform === "win32" ) {
            viewText = sprintf(`{bold}%10s{/bold} | {bold}%s{/bold} {bold}%s{/bold} | {bold}%20s{/bold} | {bold}%s{/bold}`, 
                                file.attr, date, time, StringUtils.toregular(file.size), textFileName);
        } else {
            viewText = sprintf(`{bold}%10s{/bold} | {bold}%s{/bold} {bold}%s{/bold} | {bold}%10s{/bold} | {bold}%s %s{/bold} | {bold}%s{/bold}`, 
                                file.attr, file.owner, file.group, StringUtils.toregular(file.size), date, time, textFileName);
        }
        if ( file.mimetype ) {
            viewText += ` | {bold}${file.mimetype}{/bold}`;
        }
        log.info( viewText );
        this.box.setContent(viewText);
    }
}
