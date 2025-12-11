import { jest } from "@jest/globals";
import path from "path";
import { ClipBoard, Selection } from "../Selection.mjs";
import { File } from "../../common/File.mjs";
import { Reader } from "../../common/Reader.mjs";

type ReaderDouble = {
    reader: Reader;
    readdirMock: jest.Mock<Promise<File[]>, [File]>;
    currentDirMock: jest.Mock<Promise<File>, []>;
};

const createFile = (fullname: string, overrides: Partial<File> = {}): File => {
    const file = new File();
    file.fullname = fullname;
    file.name = overrides.name ?? path.basename(fullname);
    file.dir = overrides.dir ?? false;
    file.size = overrides.size ?? 0;
    return Object.assign(file, overrides);
};

const createReaderDouble = (currentDir: File, directoryMap: Record<string, File[]>): ReaderDouble => {
    const readdirMock = jest.fn(async (dir: File) => directoryMap[dir.fullname] ?? []);
    const currentDirMock = jest.fn().mockResolvedValue(currentDir);
    const reader = {
        currentDir: currentDirMock,
        readdir: readdirMock,
        isUserCanceled: false
    } as Partial<Reader> as Reader;

    return { reader, readdirMock, currentDirMock };
};

describe("Selection.expandDir", () => {
    it("returns false when reader is missing", async () => {
        const dir = createFile("/tmp/dir", { dir: true });
        const selection = new Selection();
        selection.set([dir], dir, ClipBoard.CLIP_COPY, undefined as unknown as Reader);

        await expect(selection.expandDir()).resolves.toBe(false);
    });

    it("expands nested directories once via reader", async () => {
        const root = createFile("/root", { dir: true });
        const dirA = createFile("/root/A", { dir: true });
        const dirB = createFile("/root/A/B", { dir: true });
        const fileInA = createFile("/root/A/file.txt", { dir: false, size: 10 });

        const readerDouble = createReaderDouble(root, {
            [dirA.fullname]: [fileInA, dirB],
            [dirB.fullname]: [],
            [root.fullname]: []
        });

        const sut = new Selection();
        sut.set([dirA], root, ClipBoard.CLIP_COPY, readerDouble.reader);

        await expect(sut.expandDir()).resolves.toBe(true);
        const names = sut.getFiles().map((file) => file.fullname);
        expect(names).toEqual(expect.arrayContaining([
            dirA.fullname,
            dirB.fullname,
            fileInA.fullname
        ]));
        expect(readerDouble.readdirMock).toHaveBeenCalledWith(dirA);
        expect(readerDouble.readdirMock).toHaveBeenCalledWith(dirB);
        expect(readerDouble.readdirMock).toHaveBeenCalledWith(root);
    });

    it("does not read directories again after expansion", async () => {
        const root = createFile("/root", { dir: true });
        const dirA = createFile("/root/A", { dir: true });
        const readerDouble = createReaderDouble(root, {
            [dirA.fullname]: [],
            [root.fullname]: []
        });

        const sut = new Selection();
        sut.set([dirA], root, ClipBoard.CLIP_COPY, readerDouble.reader);

        await sut.expandDir();
        const callCount = readerDouble.readdirMock.mock.calls.length;
        await sut.expandDir();
        expect(readerDouble.readdirMock).toHaveBeenCalledTimes(callCount);
    });
});
