'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';

namespace switcher {

    //! for scode.workspace.findFiles()
    const kFindFilesLimitCount : number = 8;

    //==========================================================================
    class SplitedPath {
        dpath: string;
        fname: string;
        ename: string;
        constructor(dpath?: string, fname?: string, ename?: string) {
            this.dpath = dpath;
            this.fname = fname;
            this.ename = ename;
        }
    }

    //==========================================================================
    class Context {
        splited_path    : SplitedPath;
        first_ext_index : number;
        extensions      : string [];

        constructor() {
            this.splited_path    = new SplitedPath();
            this.first_ext_index = undefined;
            this.extensions      = [];

            const configuration = vscode.workspace.getConfiguration();
            const extensions = configuration.get("switcher.findExtensionOrder");
            for (let i in extensions) {
                this.extensions.push(extensions[i]);
            }
        }
    }
    let context = new Context();

    //==========================================================================
    function isFindAllFilesInRootDirectory() : boolean
    {
        const configuration = vscode.workspace.getConfiguration();
        if (configuration.get("switcher.findAllFilesInRootDirectory") == false) {
            return false;
        }
        return true;
    }

    //==========================================================================
    function getFileExtension(fname: string) : string
    {
        const temp_a = (/[.]/.exec(fname));
        if (temp_a) {
            const temp_b = (/[^.]+$/.exec(fname));
            return temp_b[0];
        }
        return undefined;
    }

    //==========================================================================
    function splitFilePath(fullpath: string) : SplitedPath
    {
        let dpath = fullpath;
        let fname = undefined;
        let ename = undefined;
        if (dpath) {
            fname = dpath.replace(/^.*[\\\/]/, '');
            if (fname) {
                const index = dpath.lastIndexOf(fname);
                dpath = dpath.substr(0, index - 1);

                ename = getFileExtension(fname);
                if (ename) {
                    const index = fname.lastIndexOf(ename);
                    fname = fname.substr(0, index - 1);
                }
            }
        }
        return new SplitedPath(dpath, fname, ename);
    }

    //==========================================================================
    function getExtensionIndex(ename: string) : number
    {
        if (ename) {
            for (let i in context.extensions) {
                if (context.extensions[i] == ename) {
                    return Number(i);
                }
            }
        }
        return undefined;
    }

    //==========================================================================
    function getExtensionName(ext_index: number) : string
    {
        let result = undefined;
        if (ext_index >= 0 && ext_index < context.extensions.length) {
            result = context.extensions[ext_index];
        }
        return result;
    }

    //==========================================================================
    function getNextExtensionIndex(ext_index: number) : number
    { 
        let next_ext_index = ext_index + 1;
        if (next_ext_index >= context.extensions.length) {
            next_ext_index = 0;
        }
        return next_ext_index;
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
    function findInRootDirectory(ext_index: number) : PromiseLike<any>
    {
        if (!isFindAllFilesInRootDirectory()) {
            return alwaysReject();
        }

        let target_fpath;
        target_fpath  = "**/";
        target_fpath += context.splited_path.fname;
        target_fpath += ".";
        target_fpath += getExtensionName(ext_index);
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
    function findInSameDirectory(ext_index: number) : PromiseLike<any>
    {
        let target_fpath;
        target_fpath  = context.splited_path.dpath;
        target_fpath += "/";
        target_fpath += context.splited_path.fname;
        target_fpath += ".";
        target_fpath += getExtensionName(ext_index);
        const promise = openTextDocument(target_fpath).then(
            document => {
                return Promise.resolve(document);
            },
            reason =>  {
                return findInRootDirectory(ext_index);
            }
        );
        return promise;
    };

    //==========================================================================
    function selectDocument(ext_index: number) : PromiseLike<any>
    {
        return findInSameDirectory(ext_index).then(
            document => {
                return Promise.resolve(document);
            },
            reason => {
                const next_ext_index = getNextExtensionIndex(ext_index);
                if (next_ext_index != context.first_ext_index) {
                    return selectDocument(next_ext_index);
                } else {
                    return Promise.reject(undefined);
                }
            } 
        )
    };

    //==========================================================================
    export function run()
    {
        // get the current active document
        let active_document: vscode.TextDocument = undefined;
        if (vscode.window.activeTextEditor) {
            active_document = vscode.window.activeTextEditor.document;
        }
        if (active_document == undefined) {
            return;
        }
        
        // get the parts of directory path, filename and extension
        context.splited_path = splitFilePath(
            // convert back-slash to slash
            active_document.fileName.replace(/\\/g, "/")
        ); 

        // get the extension index of the active document
        context.first_ext_index = getExtensionIndex(context.splited_path.ename);
        if (context.first_ext_index == undefined) {
            console.log("Switcher: unknown extension");
            return;
        }

        // ドキュメントの選別を開始
        const next_ext_index = getNextExtensionIndex(context.first_ext_index);
        selectDocument(next_ext_index).then(
            document => {
                console.log("Switcher: " + document.fileName);
                vscode.window.showTextDocument(document);
            },
            reason => {
                console.log("Switcher: file not found");
            }
        );
    }

} // namespace switcher.

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext)
{
    let disposable = vscode.commands.registerCommand('extension.switcher.run', switcher.run);
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate()
{
    // do nothing
}
