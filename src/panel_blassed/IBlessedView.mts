import { Reader } from "../common/Reader.mjs";
import { Widget } from "./widget/Widget.mjs";

export interface IBlessedView {
    setReader( reader: Reader );
    getReader(): Reader;
    destroy();

    getWidget(): Widget;

    setBoxDraw( hasBoxDraw: boolean );
    hasBoxDraw(): boolean;

    setFocus();
    hasFocus(): boolean;
    
    hide();
    show();

    render();
}
