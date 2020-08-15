import { Reader } from "../common/Reader";
import { Widget } from "./widget/Widget";

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
