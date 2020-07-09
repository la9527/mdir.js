import { Widget } from "./Widget";
import { Widgets, text, input, button, form, ANSIImage } from "neo-blessed";
import { File } from "../../common/File";
import { Logger } from '../../common/Logger';

const log = Logger("InputBox");

export class ImageBox extends Widget {
    ansiImage: Widgets.ANSIImageElement;

    constructor( options: any ) {
        super( { ...options, scrollable: false } );
        this.ansiImage = new ANSIImage( { parent: this.box, left: 0, top: 0, width: "100%", height: "100%", style: { fg: "yellow", bg: "red" } } );
    }

    setImage( imagefile: File | string ) {
        log.debug( "TEST !!! 1" );
        this.ansiImage.setImage( imagefile instanceof File ? imagefile.fullname : imagefile );
        log.debug( "TEST !!! 2" );
        this.ansiImage.setContent( "TEST !!!" );
    }
}
