
export interface ISubMenuConfig {
    name: string;
    method ?: string;
    funcParam ?: any[];
    key ?: string | string[];
}

export interface IMainMenuConfig {
    [mainMenu: string]: (ISubMenuConfig | string)[]
}

interface IFrameMenuConfig {
    [frame: string]: IMainMenuConfig;
}

export const menuConfig: IFrameMenuConfig = {
    Panel: {
        LinM: [ 
            { name: "About", method: "common.about" },
            { name: "Help", method: "panel.help" },
            "-",
            { name: "Settings" },
            "-",
            { name: "Quit LinM", method: "common.quit" }
        ],
        Run: [
            { name: "Run", method: "panel.keyEnterPromise" },
            { name: "Run(select)" },
            "-",
            { name: "View Console" }
        ],
        File: [
            { name : "New" },
            "-",
            { name: "ClipCopy" },
            { name: "ClipCut" },
            { name: "ClipPaste" },
            "-",
            { name: "Find" },
            { name: "Diff" }
        ],
        Directory: [
            { name: "Mcd", method: "common.runMcd" },
            { name: "Qcd" },
            "-",
            { name: "Mkdir" },
            { name: "To parent" },
            { name: "To root" },
            { name: "To home" },
            "-",
            { name: "Back" },
            { name: "Forward" }
        ],
        View: [
            { name: "Refresh", method: "panel.refresh" },
            { name: "Column AUTO" },
            "-",
            { name: "Column 1" },
            { name: "Column 2" },
            { name: "Column 3" },
            { name: "Column 4" },
            "-",
            { name: "Hidden file on/off" },
            { name: "Owner show on/off" },
            { name: "Sort change" },
            { name: "Sort Asc/Descend" },
            "-",
            { name: "Split", method: "common.split" },
            { name: "Next Window", method: "common.nextWindow" }
        ]
    }
};

