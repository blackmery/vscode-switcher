'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';

namespace switcher {

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
    function splitFilePath(fullpath: string)
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
        return { dpath: dpath, fname: fname, ename: ename };
    }

    //==========================================================================
    function getExtensionIndex(ename: string) : number
    {
        if (ename) {
            const configuration = vscode.workspace.getConfiguration();
            const extensions = configuration.get("switcher.findExtensionOrder");
            for (let i in extensions) {
                if (extensions[i] == ename) {
                    return Number(i);
                }
            }
        }
        return undefined;
    }

    //==========================================================================
    function getExtensionName(ext_index: number) : string
    {
        const configuration = vscode.workspace.getConfiguration();
        const extensions = configuration.get("switcher.findExtensionOrder");
        const extensions_length = extensions["length"];
        let result = undefined;
        if (ext_index >= 0 && ext_index < extensions_length) {
            result = extensions[ext_index];
        }
        return result;
    }

    //==========================================================================
    function getNextExtensionIndex(ext_index: number) : number
    {
        const configuration = vscode.workspace.getConfiguration();
        const extensions = configuration.get("switcher.findExtensionOrder");
        const extensions_length = extensions["length"]; 
        let next_ext_index = ext_index + 1;
        if (next_ext_index >= extensions_length) {
            next_ext_index = 0;
        }
        return next_ext_index;
    }

    //==========================================================================
    export function run()
    {
        // get the current active document
        let active_document: vscode.TextDocument = undefined;
        if (vscode.window.activeTextEditor) {
            active_document = vscode.window.activeTextEditor.document;
        }
        if (active_document == undefined) {
            // do nothing
            return;
        }

        // get the parts of directory path, filename and extension
        //  - splited_path.dpath : directory path
        //  - splited_path.fname : filename without the extension
        //  - splited_path.ename : extension
        const splited_path = splitFilePath(
            // convert back-slash to slash
            active_document.fileName.replace(/\\/g, "/")
        );

        // 無効な拡張子なら無視
        const first_ext_index = getExtensionIndex(splited_path.ename);
        if (first_ext_index == undefined) {
            console.log("Switcher: Unknown extension.");
            return;
        }

        const openTextDocument = function (fpath: string) { 
            return vscode.workspace.openTextDocument(fpath).then(
                document => {
                    return Promise.resolve(document);
                },
                reason => {
                    return Promise.reject(undefined);
                }
            );
        };

        const alwaysReject = function () {
            return openTextDocument("");
        };

        const findInRootDirectory = function (ext_index: number) {
            // ルートディレクトリ検索オプションが無効なら何もしない
            const configuration = vscode.workspace.getConfiguration();
            if (configuration.get("switcher.findAllFilesInRootDirectory") == false) {
                return alwaysReject();
            }

            let target_fpath;
            target_fpath  = "**/";
            target_fpath += splited_path.fname;
            target_fpath += ".";
            target_fpath += getExtensionName(ext_index);
            const promise = vscode.workspace.findFiles(target_fpath, "", 8).then(
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

        const findInSameDirectory = function (ext_index: number) {
            // 同一ディレクトリを検索
            let target_fpath;
            target_fpath  = splited_path.dpath;
            target_fpath += "/";
            target_fpath += splited_path.fname;
            target_fpath += ".";
            target_fpath += getExtensionName(ext_index);
            const promise = openTextDocument(target_fpath).then(
                document => {
                    return Promise.resolve(document);
                },
                reason =>  {
                    // ルートディレクトリ以下のファイルを検索
                    return findInRootDirectory(ext_index);
                }
            );
            return promise;
        };

        const selectDocument = function (ext_index: number) {
            return findInSameDirectory(ext_index).then(
                document => {
                    // 選択されたドキュメントを返す
                    return Promise.resolve(document);
                },
                reason => {
                    const next_ext_index = getNextExtensionIndex(ext_index);
                    if (next_ext_index != first_ext_index) {
                        return selectDocument(next_ext_index);
                    } else {
                        return Promise.reject(undefined);
                    }
                } 
            )
        };

        // ドキュメントの選別を開始
        const next_ext_index = getNextExtensionIndex(first_ext_index);
        selectDocument(next_ext_index).then(
            document => {
                console.log("done: " + document.fileName);
                vscode.window.showTextDocument(document);
            },
            reason => {
                console.log("done: file not found.");
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
