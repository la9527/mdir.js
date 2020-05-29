import { Reader } from "../common/Reader";
import { Widget } from "./Widget";

export interface IBlessedView {
    setReader( reader: Reader );
    getReader(): Reader;
    destroy();

    getWidget(): Widget;

    setFocus();
    hasFocus(): boolean;
    
    hide();
    show();

    render();
}
