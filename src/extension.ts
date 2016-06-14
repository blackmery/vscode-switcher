'use strict';
import * as vscode from 'vscode';
import * as path from 'path';

namespace switcher {

    //! for scode.workspace.findFiles()
    const kFindFilesLimitCount : number = 8;

    //==========================================================================
    class SplitedPath {
        dirname : string;
        basename: string;
        suffix  : string;
        constructor(dirname?: string, basename?: string, suffix?: string) {
            this.dirname  = dirname;
            this.basename = basename;
            this.suffix   = suffix;
        }
    }

    //==========================================================================
    class Context {
        entry_point  : any;
        splited_path : SplitedPath;
        first_index  : number;
        suffixes     : string [];

        constructor() {
            this.entry_point  = undefined;
            this.splited_path = new SplitedPath();
            this.first_index  = undefined;
            this.suffixes     = [];

            const configuration = vscode.workspace.getConfiguration();
            const suffixes      = configuration.get("switcher.findSuffixOrder");
            for (let i in suffixes) {
                this.suffixes.push(suffixes[i]);
            }
        }
    }
    let context = new Context();

    //==========================================================================
    function appendEspaceForRegex(s: string) : string
    {  
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    };

    //==========================================================================
    function isFindAllFilesInWorkspaceRoot() : boolean
    {
        if (context.entry_point == doSwitchInWorkspaceRoot) {
            return true;
        }

        const configuration = vscode.workspace.getConfiguration();
        if (configuration.get("switcher.findAllFilesInWorkspaceRoot") == false) {
            return false;
        }
        return true;
    }

    //==========================================================================
    function splitFilePath(fullpath: string) : SplitedPath
    {
        const dirname  = path.dirname(fullpath);
        let   basename = path.basename(fullpath);
        const suffix   = getSuffixByFileName(basename);
        if (suffix != undefined) {
            // remove suffix from basename
            const re  = new RegExp("" + appendEspaceForRegex(suffix) + "$", "i");
            basename = basename.replace(re, "");
        }
        return new SplitedPath(dirname, basename, suffix);
    }

    //==========================================================================
    function getSuffixIndex(filename: string) : number
    {
        if (filename) {
            for (let i in context.suffixes) {
                const suffix = context.suffixes[i];
                const re     = new RegExp("" + appendEspaceForRegex(suffix) + "$", "i");
                if (filename.match(re)) {
                    return Number(i);
                }
            }
        }
        return undefined;
    }

    //==========================================================================
    function getSuffixByIndex(suffix_index: number) : string
    {
        let result = undefined;
        if (suffix_index >= 0 && suffix_index < context.suffixes.length) {
            result = context.suffixes[suffix_index];
        }
        return result;
    }

    //==========================================================================
    function getSuffixByFileName(filename: string) : string
    {
        const suffix_index = getSuffixIndex(filename);
        if (suffix_index != undefined) {
            return getSuffixByIndex(suffix_index);
        }
        return undefined;
    }

    //==========================================================================
    function getNextSuffixIndex(suffix_index: number) : number
    { 
        let next_suffix_index = suffix_index + 1;
        if (next_suffix_index >= context.suffixes.length) {
            next_suffix_index = 0;
        }
        return next_suffix_index;
    }

    //==========================================================================
    function openTextDocument(fpath: string) : PromiseLike<any>
    {
        return vscode.workspace.openTextDocument(fpath).then(
            document => {
                return Promise.resolve(document);
            },
            reason => {
                return Promise.reject(undefined);
            }
        );
    };

    //==========================================================================
    function alwaysReject() : PromiseLike<any>
    {
        // TODO: Microsoft/vscode: vscode debugger stops on reject() #1746  
        // return new Promise((resolve, reject) => {
        //     return reject(undefined);
        // });
        return openTextDocument("");
    }

    //==========================================================================
    function findInWorkspaceRoot(suffix_index: number) : PromiseLike<any>
    {
        if (!isFindAllFilesInWorkspaceRoot()) {
            return alwaysReject();
        }

        let target_fpath;
        target_fpath  = "**/";
        target_fpath += context.splited_path.basename;
        target_fpath += getSuffixByIndex(suffix_index);
        const promise = vscode.workspace.findFiles(target_fpath, "", kFindFilesLimitCount).then(
            files => {
                if (files.length == 1) {
                    const file = files.pop();
                    return openTextDocument(file.fsPath);
                } else if (files.length > 1) {
                    let file_list = [];
                    files.forEach(file => {
                        file_list.push(file.fsPath);
                    });

                    return vscode.window.showQuickPick(file_list).then(
                        file => {
                            return openTextDocument(file);
                        },
                        reason => {
                            return Promise.reject(undefined);
                        }
                    );
                }
                // files.length == 0
                return alwaysReject();
            },
            reason => {
                return Promise.reject(undefined);
            }
        );
        return promise;
    };

    //==========================================================================
    function findInSameDirectory(suffix_index: number) : PromiseLike<any>
    {
        let target_fpath;
        target_fpath  = context.splited_path.dirname;
        target_fpath += "/";
        target_fpath += context.splited_path.basename;
        target_fpath += getSuffixByIndex(suffix_index);
        const promise = openTextDocument(target_fpath).then(
            document => {
                return Promise.resolve(document);
            },
            reason =>  {
                return findInWorkspaceRoot(suffix_index);
            }
        );
        return promise;
    };

    //==========================================================================
    function selectDocument(suffix_index: number) : PromiseLike<any>
    {
        return findInSameDirectory(suffix_index).then(
            document => {
                return Promise.resolve(document);
            },
            reason => {
                const next_suffix_index = getNextSuffixIndex(suffix_index);
                if (next_suffix_index != context.first_index) {
                    return selectDocument(next_suffix_index);
                } else {
                    return Promise.reject(undefined);
                }
            } 
        )
    };

    //==========================================================================
    export function doSwitch()
    {
        if (context.entry_point == undefined) {
            context.entry_point = doSwitch;
        }

        // Get the current active document
        let active_document: vscode.TextDocument = undefined;
        if (vscode.window.activeTextEditor) {
            active_document = vscode.window.activeTextEditor.document;
        }
        if (active_document == undefined) {
            return;
        }
        
        // Get the parts of directory path, filename and extension
        context.splited_path = splitFilePath(
            // convert back-slash to slash
            active_document.fileName.replace(/\\/g, "/")
        );

        // Get the extension index of the active document
        context.first_index = getSuffixIndex(context.splited_path.suffix);
        if (context.first_index == undefined) {
            console.log("Switcher: unknown extension");
            return;
        }

        // ドキュメントの選別を開始
        const next_suffix_index = getNextSuffixIndex(context.first_index);
        selectDocument(next_suffix_index).then(
            document => {
                console.log("Switcher: " + document.fileName);
                vscode.window.showTextDocument(document);
            },
            reason => {
                console.log("Switcher: file not found");
            }
        );
    }

    export function doSwitchInWorkspaceRoot()
    {
        context.entry_point = doSwitchInWorkspaceRoot;
        doSwitch();
    }

} // namespace switcher.

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext)
{
    let disposable;

    disposable = vscode.commands.registerCommand(
        'extension.switcher.doSwitch',
        switcher.doSwitch
    );
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand(
        'extension.switcher.doSwitchInWorkspaceRoot',
        switcher.doSwitchInWorkspaceRoot
    );
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate()
{
    // do nothing
}
